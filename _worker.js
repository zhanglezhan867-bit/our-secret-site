// Cloudflare Pages 反代 + 静态托管（Advanced Mode Worker）
// 网站静态文件由 Pages 提供；Supabase API 请求（/auth /rest /storage ...）转发到 Supabase
const TARGET = "https://eebpxfsgmzmavfvnuifv.supabase.co";

const API_PREFIXES = ["/auth/v1", "/rest/v1", "/storage/v1", "/functions/v1", "/realtime/v1"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isApi = API_PREFIXES.some((p) => url.pathname.startsWith(p));

    // 静态资源交给 Pages
    if (!isApi) {
      if (env && env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("not found", { status: 404 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("cf-connecting-ip");
    const init = { method: request.method, headers, redirect: "follow" };
    if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;

    let resp;
    try {
      resp = await fetch(TARGET + url.pathname + url.search, init);
    } catch (e) {
      return new Response(JSON.stringify({ error: "proxy_failed", message: String(e) }), {
        status: 502,
        headers: Object.assign({ "Content-Type": "application/json" }, CORS),
      });
    }
    const out = new Headers(resp.headers);
    for (const k in CORS) out.set(k, CORS[k]);
    return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: out });
  },
};
