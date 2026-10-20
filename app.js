/* ============================================================
   长乐 & 楠楠 的秘密小站
   纯前端 + Supabase（登录 / 数据库 / 照片存储）
   ============================================================ */
(function () {
  "use strict";

  // ---------------- 配置与客户端 ----------------
  var cfg = window.APP_CONFIG || {};
  var configured =
    cfg.SUPABASE_URL && cfg.SUPABASE_URL.indexOf("在这里") === -1 &&
    cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_ANON_KEY.indexOf("在这里") === -1;
  var sb = null;
  if (configured && window.supabase) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  // ---------------- 工具 ----------------
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  var toastTimer = null;
  function toast(msg, ms) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.add("hidden"); }, ms || 2400);
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  function fmtDate(d) {
    if (!d) return "";
    var x = new Date(d);
    return x.getFullYear() + "-" + pad2(x.getMonth() + 1) + "-" + pad2(x.getDate());
  }

  function fmtDateTime(d) {
    if (!d) return "";
    var x = new Date(d);
    return fmtDate(x) + " " + pad2(x.getHours()) + ":" + pad2(x.getMinutes());
  }

  function todayLabel() {
    var d = new Date();
    var w = "日一二三四五六".charAt(d.getDay());
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日 星期" + w;
  }

  function showModal(url) {
    $("#modal-img").src = url;
    $("#modal").classList.remove("hidden");
  }
  function hideModal() {
    $("#modal").classList.add("hidden");
    $("#modal-img").src = "";
  }

  function errText(e) {
    if (!e) return "未知错误";
    return e.message || e.error_description || String(e);
  }

  // ---------------- 农历生日 ----------------
  function nextLunarBirthday(month, day) {
    if (!month || !day || !window.Lunar) return null;
    var now = new Date();
    var startYear = Lunar.fromDate(now).getYear();
    for (var y = startYear; y <= startYear + 2; y++) {
      try {
        var lunar = Lunar.fromYmd(y, month, day);
        var solar = lunar.getSolar();
        var d = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay(), 0, 0, 0, 0);
        if (d.getTime() + 86400000 > now.getTime()) {
          return { date: d, monthCn: lunar.getMonthInChinese(), dayCn: lunar.getDayInChinese(), lunarYear: y };
        }
      } catch (e) { /* 该年农历没有这一天，试下一年 */ }
    }
    return null;
  }

  function fmtCountdown(target) {
    var now = new Date();
    var diff = target.getTime() - now.getTime();
    if (diff <= 0) {
      var todayDiff = now.getTime() - target.getTime();
      if (todayDiff < 86400000) return { today: true, text: "今天就是生日！🎂" };
      return { today: false, text: "已过" };
    }
    var days = Math.floor(diff / 86400000);
    var hours = Math.floor((diff % 86400000) / 3600000);
    var mins = Math.floor((diff % 3600000) / 60000);
    var secs = Math.floor((diff % 60000) / 1000);
    return { today: false, days: days, text: pad2(hours) + ":" + pad2(mins) + ":" + pad2(secs) };
  }

  // ---------------- 状态 ----------------
  var state = {
    user: null,
    profiles: [],
    photos: [],
    photoUrls: {},
    notes: [],
    chats: [],
    chatUrls: {},
    answers: [],
    secrets: [],
    secretCode: null,
    secretUnlocked: false,
    moreView: "menu",
    currentPage: "home",
    timer: null
  };

  function myProfile() {
    if (!state.user) return null;
    for (var i = 0; i < state.profiles.length; i++) {
      if (state.profiles[i].id === state.user.id) return state.profiles[i];
    }
    return null;
  }

  function otherProfile() {
    if (!state.user) return null;
    for (var i = 0; i < state.profiles.length; i++) {
      if (state.profiles[i].id !== state.user.id) return state.profiles[i];
    }
    return null;
  }

  function myNickname() {
    var p = myProfile();
    return (p && p.nickname) ? p.nickname : "我";
  }

  function nicknameOf(userId) {
    for (var i = 0; i < state.profiles.length; i++) {
      if (state.profiles[i].id === userId) return state.profiles[i].nickname || "TA";
    }
    if (state.user && userId === state.user.id) return myNickname();
    return "TA";
  }

  // ---------------- 认证 ----------------
  function setAuthMsg(msg) { $("#auth-msg").textContent = msg || ""; }

  async function doLogin() {
    if (!sb) { setAuthMsg("请先在 config.js 里填好 Supabase 配置"); return; }
    var email = $("#auth-email").value.trim();
    var password = $("#auth-password").value;
    if (!email || !password) { setAuthMsg("邮箱和密码都要填哦"); return; }
    var btn = $("#btn-login");
    btn.disabled = true; btn.textContent = "登录中…";
    try {
      var res = await sb.auth.signInWithPassword({ email: email, password: password });
      if (res.error) throw res.error;
      setAuthMsg("");
    } catch (e) {
      setAuthMsg("登录失败：" + errText(e));
    } finally {
      btn.disabled = false; btn.textContent = "进入小站";
    }
  }

  async function doSignup() {
    if (!sb) { setAuthMsg("请先在 config.js 里填好 Supabase 配置"); return; }
    var email = $("#auth-email").value.trim();
    var password = $("#auth-password").value;
    if (!email || password.length < 6) { setAuthMsg("邮箱要填，密码至少 6 位"); return; }
    var btn = $("#btn-signup");
    btn.disabled = true; btn.textContent = "注册中…";
    try {
      var res = await sb.auth.signUp({ email: email, password: password });
      if (res.error) throw res.error;
      setAuthMsg(res.data && res.data.session
        ? "注册成功，正在进入…"
        : "注册成功！如果登录不了，去 Supabase → Authentication 里把邮箱确认关掉，或手动确认这个邮箱。");
    } catch (e) {
      setAuthMsg("注册失败：" + errText(e));
    } finally {
      btn.disabled = false; btn.textContent = "注册新账号";
    }
  }

  async function doLogout() {
    if (sb) await sb.auth.signOut();
    location.reload();
  }

  // ---------------- 数据加载 ----------------
  async function loadProfiles() {
    var res = await sb.from("profiles").select("*");
    if (res.error) throw res.error;
    state.profiles = res.data || [];
  }

  async function loadPhotos() {
    var res = await sb.from("photos").select("*").order("created_at", { ascending: false });
    if (res.error) throw res.error;
    state.photos = res.data || [];
    await signPhotoUrls();
  }

  async function signPhotoUrls() {
    state.photoUrls = {};
    var paths = state.photos.map(function (p) { return p.path; });
    if (!paths.length || !sb) return;
    var res = await sb.storage.from("photos").createSignedUrls(paths, 3600);
    if (res.error) return;
    (res.data || []).forEach(function (x) { if (x.signedUrl) state.photoUrls[x.path] = x.signedUrl; });
  }

  async function loadNotes() {
    var res = await sb.from("notes").select("*").order("created_at", { ascending: false });
    if (res.error) throw res.error;
    state.notes = res.data || [];
  }

  async function loadChats() {
    var res = await sb.from("chats").select("*").order("sent_at", { ascending: true });
    if (res.error) throw res.error;
    state.chats = res.data || [];
    state.chatUrls = {};
    var paths = state.chats.filter(function (c) { return c.image_path; }).map(function (c) { return c.image_path; });
    if (paths.length) {
      var r2 = await sb.storage.from("photos").createSignedUrls(paths, 3600);
      if (!r2.error) (r2.data || []).forEach(function (x) { if (x.signedUrl) state.chatUrls[x.path] = x.signedUrl; });
    }
  }

  async function loadAnswers() {
    var res = await sb.from("answers").select("*");
    if (res.error) throw res.error;
    state.answers = res.data || [];
  }

  async function loadSecrets() {
    var res = await sb.from("secrets").select("*").order("created_at", { ascending: false });
    if (res.error) throw res.error;
    state.secrets = res.data || [];
  }

  async function loadSecretCode() {
    var res = await sb.from("settings").select("*").eq("key", "secret_code").maybeSingle();
    if (res.error) return;
    state.secretCode = res.data ? res.data.value : null;
  }

  async function loadAll() {
    try {
      await loadProfiles();
      await Promise.all([loadPhotos(), loadNotes(), loadChats(), loadAnswers(), loadSecrets(), loadSecretCode()]);
      renderAll();
    } catch (e) {
      toast("数据加载失败：" + errText(e), 4000);
    }
  }

  // ---------------- 页面切换 ----------------
  function switchPage(name) {
    state.currentPage = name;
    $$(".page").forEach(function (p) { p.classList.remove("active"); });
    var page = $("#page-" + name);
    if (page) page.classList.add("active");
    $$(".tab").forEach(function (t) { t.classList.toggle("active", t.dataset.page === name); });
    if (name === "home") renderHome();
    if (name === "photos") renderPhotos();
    if (name === "notes") renderNotes();
    if (name === "chat") renderChat();
    if (name === "more") renderMore();
    window.scrollTo(0, 0);
  }

  function renderAll() {
    renderHome();
    renderPhotos();
    renderNotes();
    renderChat();
    renderMore();
  }

  // ---------------- 首页 ----------------
  function renderHome() {
    var el = $("#page-home");
    var hour = new Date().getHours();
    var greet = hour < 6 ? "夜深了，早点睡呀" : hour < 11 ? "早上好呀" : hour < 14 ? "中午好呀" : hour < 18 ? "下午好呀" : "晚上好呀";
    var me = myProfile();
    var ta = otherProfile();

    function cdCard(title, p) {
      if (!p || !p.lunar_month || !p.lunar_day) {
        return '<div class="cd-card"><div class="cd-name">' + escapeHtml(title) + '</div>' +
          '<div class="cd-sub">还没设置农历生日</div>' +
          '<div class="muted">去「更多 → 个人资料」里填一下～</div></div>';
      }
      var nb = nextLunarBirthday(p.lunar_month, p.lunar_day);
      if (!nb) {
        return '<div class="cd-card"><div class="cd-name">' + escapeHtml(title) + '</div>' +
          '<div class="cd-sub">农历' + p.lunar_month + "月" + p.lunar_day + '日</div>' +
          '<div class="muted">日期计算失败，检查一下生日设置</div></div>';
      }
      var c = fmtCountdown(nb.date);
      var sub = "农历" + nb.monthCn + "月" + nb.dayCn + " · " + (nb.date.getMonth() + 1) + "月" + nb.date.getDate() + "日";
      var main = c.today
        ? '<div class="cd-today">今天就是生日！🎂</div>'
        : '<div class="cd-days">' + c.days + '<span>天</span></div><div class="cd-time">' + c.text + '</div>';
      return '<div class="cd-card" data-cd-name="' + escapeHtml(title) + '" data-cd-target="' + nb.date.getTime() + '">' +
        '<div class="cd-name">🎂 ' + escapeHtml(title) + '</div>' +
        '<div class="cd-sub">' + escapeHtml(sub) + '</div>' + main + '</div>';
    }

    el.innerHTML =
      '<div class="card">' +
        '<div class="section-title">' + greet + '，' + escapeHtml(myNickname()) + ' 💕</div>' +
        '<div class="muted">' + escapeHtml(todayLabel()) + '</div>' +
        (state.profiles.length < 2
          ? '<div class="muted" style="margin-top:10px">提醒：另一位还没有在「更多 → 个人资料」里设置昵称和生日，设好之后倒计时就齐啦～</div>'
          : '') +
      '</div>' +
      '<div class="section-title">🎂 生日倒计时</div>' +
      '<div class="countdowns">' +
        cdCard(me && me.nickname ? me.nickname : "我", me) +
        cdCard(ta && ta.nickname ? ta.nickname : "TA", ta) +
      '</div>' +
      '<div class="section-title" style="margin-top:18px">✨ 快捷入口</div>' +
      '<div class="quick-grid">' +
        '<button class="quick-item" data-go="photos"><b>📷</b>照片墙</button>' +
        '<button class="quick-item" data-go="notes"><b>✍️</b>写点什么</button>' +
        '<button class="quick-item" data-go="chat"><b>💬</b>聊天记录</button>' +
      '</div>' +
      '<div class="card" style="margin-top:14px">' +
        '<div class="card-title">🎮 想玩点什么</div>' +
        '<div class="muted">「更多」里有情侣问答和秘密空间，去看看吧～</div>' +
      '</div>';

    $$('[data-go]', el).forEach(function (btn) {
      btn.addEventListener("click", function () { switchPage(btn.dataset.go); });
    });

    // 倒计时每秒刷新
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(function () {
      if (state.currentPage !== "home") return;
      $$(".cd-card[data-cd-target]").forEach(function (card) {
        var target = parseInt(card.dataset.cdTarget, 10);
        if (!target) return;
        var c = fmtCountdown(new Date(target));
        var box = card.querySelector(".cd-days");
        var time = card.querySelector(".cd-time");
        var today = card.querySelector(".cd-today");
        if (c.today) {
          if (box) { box.innerHTML = '今天就是生日！🎂'; box.style.fontSize = '18px'; }
          if (time) time.textContent = '';
        } else if (box && time) {
          box.innerHTML = c.days + '<span>天</span>';
          time.textContent = c.text;
        }
      });
    }, 1000);
  }

  // ---------------- 照片 ----------------
  function renderPhotos() {
    var el = $("#page-photos");
    var grid = state.photos.map(function (p) {
      var url = state.photoUrls[p.path] || "";
      return '<div class="photo-cell" data-view="' + escapeHtml(url) + '">' +
        (url ? '<img src="' + escapeHtml(url) + '" loading="lazy" alt="">' : '<div class="empty">加载中…</div>') +
        (p.caption ? '<div class="cap">' + escapeHtml(p.caption) + '</div>' : '') +
        '<button class="del" data-del-photo="' + p.id + '" data-path="' + escapeHtml(p.path) + '">✕</button>' +
        '</div>';
    }).join("");

    el.innerHTML =
      '<div class="card">' +
        '<div class="card-title">📷 我们的照片墙</div>' +
        '<div class="upload-bar">' +
          '<button class="btn btn-primary btn-sm" id="btn-upload-photo">＋ 上传照片</button>' +
          '<span class="upload-hint">手机可以直接从相册选，支持多张</span>' +
          '<input type="file" id="photo-input" accept="image/*" multiple hidden>' +
        '</div>' +
        '<div class="muted" id="upload-status"></div>' +
      '</div>' +
      (state.photos.length
        ? '<div class="photo-grid">' + grid + '</div>'
        : '<div class="empty">还没有照片，上传第一张吧 📷</div>');

    var input = $("#photo-input");
    $("#btn-upload-photo").addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () { uploadPhotos(input.files); });

    $$("[data-view]", el).forEach(function (cell) {
      cell.addEventListener("click", function (ev) {
        if (ev.target.closest(".del")) return;
        var u = cell.dataset.view;
        if (u) showModal(u);
      });
    });
    $$("[data-del-photo]", el).forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        deletePhoto(btn.dataset.delPhoto, btn.dataset.path);
      });
    });
  }

  async function uploadPhotos(files) {
    if (!sb || !files || !files.length) return;
    var status = $("#upload-status");
    var total = files.length, done = 0;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (status) status.textContent = "上传中 " + (i + 1) + "/" + total + " …";
      try {
        var ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        var path = state.user.id + "/" + Date.now() + "_" + Math.random().toString(36).slice(2, 8) + "." + ext;
        var up = await sb.storage.from("photos").upload(path, f, { contentType: f.type || "image/jpeg" });
        if (up.error) throw up.error;
        var ins = await sb.from("photos").insert({ path: path, uploader: state.user.id });
        if (ins.error) throw ins.error;
        done++;
      } catch (e) {
        toast("第 " + (i + 1) + " 张上传失败：" + errText(e), 4000);
      }
    }
    if (status) status.textContent = done ? "上传完成 ✓" : "";
    var inp = $("#photo-input");
    if (inp) inp.value = "";
    await loadPhotos();
    renderPhotos();
    toast(done ? "上传成功 " + done + " 张 💕" : "没有上传成功");
  }

  async function deletePhoto(id, path) {
    if (!confirm("确定删除这张照片吗？")) return;
    try {
      if (path) await sb.storage.from("photos").remove([path]);
      var res = await sb.from("photos").delete().eq("id", id);
      if (res.error) throw res.error;
      await loadPhotos();
      renderPhotos();
      toast("已删除");
    } catch (e) { toast("删除失败：" + errText(e)); }
  }

  // ---------------- 文字 ----------------
  function renderNotes() {
    var el = $("#page-notes");
    var list = state.notes.map(function (n) {
      return '<div class="note-item">' +
        '<div class="note-head">' +
          '<div class="note-title">' + escapeHtml(n.title || "无标题") + '</div>' +
          '<button class="note-del" data-del-note="' + n.id + '">删除</button>' +
        '</div>' +
        '<div class="note-content">' + escapeHtml(n.content) + '</div>' +
        '<div class="note-author">' + escapeHtml(nicknameOf(n.author)) + ' · ' + escapeHtml(fmtDateTime(n.created_at)) + '</div>' +
        '</div>';
    }).join("");

    el.innerHTML =
      '<div class="card">' +
        '<div class="card-title">✍️ 写点什么</div>' +
        '<div class="form-row"><input id="note-title" class="input" placeholder="标题（可以不写）" maxlength="60"></div>' +
        '<div class="form-row"><textarea id="note-content" class="input" placeholder="今天想说的话…"></textarea></div>' +
        '<button id="btn-add-note" class="btn btn-primary btn-block">保存到我们的文字墙</button>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-title">📖 我们的文字</div>' +
        (state.notes.length ? list : '<div class="empty">还没有文字，写下第一句吧～</div>') +
      '</div>';

    $("#btn-add-note").addEventListener("click", addNote);
    $$("[data-del-note]", el).forEach(function (btn) {
      btn.addEventListener("click", function () { deleteNote(btn.dataset.delNote); });
    });
  }

  async function addNote() {
    var title = $("#note-title").value.trim();
    var content = $("#note-content").value.trim();
    if (!content) { toast("写点内容再保存呀"); return; }
    try {
      var res = await sb.from("notes").insert({ title: title || null, content: content, author: state.user.id });
      if (res.error) throw res.error;
      await loadNotes();
      renderNotes();
      toast("保存好啦 💕");
    } catch (e) { toast("保存失败：" + errText(e)); }
  }

  async function deleteNote(id) {
    if (!confirm("确定删除这条文字吗？")) return;
    try {
      var res = await sb.from("notes").delete().eq("id", id);
      if (res.error) throw res.error;
      await loadNotes();
      renderNotes();
      toast("已删除");
    } catch (e) { toast("删除失败：" + errText(e)); }
  }

  // ---------------- 聊天 ----------------
  function renderChat() {
    var el = $("#page-chat");
    var myName = myNickname();
    var list = state.chats.map(function (c) {
      var mine = c.sender === myName || (c.user_id && state.user && c.user_id === state.user.id);
      var inner;
      if (c.image_path) {
        var url = state.chatUrls[c.image_path] || "";
        inner = url ? '<img class="chat-img" src="' + escapeHtml(url) + '" data-view="' + escapeHtml(url) + '" alt="">' : '<span class="muted">图片加载中…</span>';
      } else {
        inner = escapeHtml(c.content || "");
      }
      return '<div class="msg ' + (mine ? "me" : "other") + '">' +
        '<div class="who">' + escapeHtml(c.sender || "TA") + '</div>' +
        '<div class="bubble">' + inner + '</div>' +
        '<div class="time">' + escapeHtml(fmtDateTime(c.sent_at)) + '</div>' +
        '</div>';
    }).join("");

    el.innerHTML =
      '<div class="card">' +
        '<div class="card-title">💬 导入聊天记录</div>' +
        '<div class="muted" style="margin-bottom:8px">把聊天文字粘进来，每行一条，格式：<b>昵称：内容</b>（前面可加日期，如 [2025-01-01 20:00] 长乐：晚安）</div>' +
        '<textarea id="chat-import" class="input" placeholder="长乐：晚上吃什么？&#10;楠楠：火锅！&#10;长乐：好，我请客～"></textarea>' +
        '<div class="row2" style="margin-top:10px">' +
          '<button id="btn-import-chat" class="btn btn-primary btn-sm">导入文字</button>' +
          '<button id="btn-chat-image" class="btn btn-blue btn-sm">上传聊天截图</button>' +
          '<input type="file" id="chat-image-input" accept="image/*" hidden>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-title">🕰 我们的聊天</div>' +
        (state.chats.length ? '<div class="chat-list">' + list + '</div>' : '<div class="empty">还没有记录，导入一段吧～</div>') +
      '</div>';

    $("#btn-import-chat").addEventListener("click", importChatText);
    $("#btn-chat-image").addEventListener("click", function () { $("#chat-image-input").click(); });
    $("#chat-image-input").addEventListener("change", function () { uploadChatImage(this.files); });
    $$("[data-view]", el).forEach(function (img) {
      img.addEventListener("click", function () { showModal(img.dataset.view); });
    });
  }

  function parseChatLines(text) {
    var lines = text.split(/\r?\n/);
    var out = [];
    var base = Date.now();
    var i = 0;
    lines.forEach(function (line) {
      var s = line.trim();
      if (!s) return;
      var when = null;
      var m = s.match(/^\[?(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?\]?\s*(.*)$/);
      if (m) {
        when = new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 20, m[5] ? +m[5] : 0);
        s = m[6];
      }
      var mm = s.match(/^([^:：]{1,24})[：:]\s*(.*)$/);
      if (!mm) return;
      out.push({ sender: mm[1].trim(), content: mm[2], sent_at: when ? when.toISOString() : new Date(base + i * 60000).toISOString() });
      i++;
    });
    return out;
  }

  async function importChatText() {
    var text = $("#chat-import").value;
    var rows = parseChatLines(text || "");
    if (!rows.length) { toast("没识别到内容，检查一下格式：昵称：内容"); return; }
    try {
      var res = await sb.from("chats").insert(rows);
      if (res.error) throw res.error;
      $("#chat-import").value = "";
      await loadChats();
      renderChat();
      toast("导入了 " + rows.length + " 条 💕");
    } catch (e) { toast("导入失败：" + errText(e)); }
  }

  async function uploadChatImage(files) {
    if (!files || !files.length) return;
    var f = files[0];
    try {
      var ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      var path = state.user.id + "/chat_" + Date.now() + "." + ext;
      var up = await sb.storage.from("photos").upload(path, f, { contentType: f.type || "image/jpeg" });
      if (up.error) throw up.error;
      var ins = await sb.from("chats").insert({ sender: myNickname(), content: null, image_path: path, sent_at: new Date().toISOString() });
      if (ins.error) throw ins.error;
      await loadChats();
      renderChat();
      var ci = $("#chat-image-input");
      if (ci) ci.value = "";
      toast("截图已加入聊天墙");
    } catch (e) { toast("上传失败：" + errText(e)); }
  }

  // ---------------- 更多 ----------------
  function renderMore() {
    var el = $("#page-more");
    if (state.moreView === "quiz") { renderQuiz(); return; }
    if (state.moreView === "secret") { renderSecret(); return; }
    if (state.moreView === "settings") { renderSettings(); return; }
    el.innerHTML =
      '<div class="menu-list">' +
        '<button class="menu-item" data-more="quiz"><b>🎮</b><div><span class="t">情侣问答</span><span class="d">看看你们有多懂对方</span></div><span class="arrow">›</span></button>' +
        '<button class="menu-item" data-more="secret"><b>🔒</b><div><span class="t">秘密空间</span><span class="d">只说给对方听的话</span></div><span class="arrow">›</span></button>' +
        '<button class="menu-item" data-more="settings"><b>⚙️</b><div><span class="t">个人资料与设置</span><span class="d">昵称、农历生日、暗号、退出</span></div><span class="arrow">›</span></button>' +
      '</div>';
    $$("[data-more]", el).forEach(function (b) {
      b.addEventListener("click", function () { state.moreView = b.dataset.more; renderMore(); window.scrollTo(0, 0); });
    });
  }

  function backToMore() {
    state.moreView = "menu";
    renderMore();
  }

  // ---------------- 情侣问答 ----------------
  var QUIZ = [
    "对方最喜欢吃什么？", "对方最害怕什么？", "对方最喜欢的颜色？", "对方最想去哪里旅行？",
    "你们第一次见面是什么场景？", "对方生气时的表现？", "对方最喜欢的季节？", "对方最常说的口头禅？",
    "对方无聊时喜欢做什么？", "对方最看重你哪一点？", "对方最讨厌的食物？", "对方喜欢的音乐类型？",
    "对方最近在追什么剧/看什么？", "对方最难忘的一次生日？", "对方最想养什么宠物？", "对方心情不好时最想你怎么做？",
    "对方最喜欢你叫他/她的昵称？", "你们第一次牵手/拥抱在哪？", "对方最怕你做什么？", "对方最开心的一次约会？",
    "对方觉得你们俩谁更粘人？", "对方最擅长的一道菜？", "对方最喜欢的一部电影？", "对方最想收到的礼物？",
    "对方熬夜的时候在干嘛？", "对方最喜欢的一张你们的合照？", "对方最怕冷还是怕热？", "对方最崇拜的人是谁？",
    "对方觉得最浪漫的事是什么？", "对方希望十年后的你们是什么样子？"
  ];

  function answersFor(qIndex) {
    var map = {};
    state.answers.forEach(function (a) { if (a.question_id === qIndex) map[a.user_id] = a.answer; });
    return map;
  }

  function renderQuiz() {
    var el = $("#page-more");
    var meId = state.user.id;
    var ta = otherProfile();
    var answeredBoth = 0;
    var items = '';

    QUIZ.forEach(function (q, idx) {
      var map = answersFor(idx);
      var mine = map[meId];
      var theirs = ta ? map[ta.id] : undefined;
      if (mine !== undefined && theirs !== undefined) answeredBoth++;
      items += '<div class="quiz-item card">' +
        '<div class="quiz-q">' + (idx + 1) + ". " + escapeHtml(q) + '</div>' +
        (mine !== undefined
          ? '<div class="quiz-answer"><b>我：</b>' + escapeHtml(mine) + '</div>'
          : '<div class="quiz-input-row"><input class="input" id="ans-' + idx + '" placeholder="我的答案…" maxlength="80">' +
            '<button class="btn btn-primary btn-sm" data-ans="' + idx + '">答</button></div>') +
        (theirs !== undefined
          ? '<div class="quiz-answer" style="margin-top:6px"><b>' + escapeHtml(ta && ta.nickname ? ta.nickname : "TA") + '：</b>' + escapeHtml(theirs) + '</div>'
          : (ta ? '<div class="muted" style="margin-top:6px">TA 还没答这题～</div>' : '')) +
        '</div>';
    });

    var pct = Math.round((answeredBoth / QUIZ.length) * 100);
    el.innerHTML = '<button class="back-btn" id="back-more">‹ 返回</button>' +
      '<div class="card"><div class="card-title">🎮 情侣问答</div>' +
      '<div class="muted">各自回答，答完就能看到对方的答案～</div>' +
      '<div style="margin-top:10px;font-size:15px;font-weight:700;color:var(--pink)">双人都已回答：' + answeredBoth + ' / ' + QUIZ.length + '（' + pct + '%）</div>' +
      '</div>' + items;

    $("#back-more").addEventListener("click", backToMore);
    el.querySelectorAll("[data-ans]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.dataset.ans, 10);
        var input = $("#ans-" + idx);
        submitAnswer(idx, input.value.trim());
      });
    });
  }

  async function submitAnswer(qIndex, value) {
    if (!value) { toast("先写个答案呀"); return; }
    try {
      var res = await sb.from("answers").upsert({
        question_id: qIndex, user_id: state.user.id, answer: value, updated_at: new Date().toISOString()
      }, { onConflict: "question_id,user_id" });
      if (res.error) throw res.error;
      await loadAnswers();
      renderQuiz();
      toast("答案已保存 💕");
    } catch (e) { toast("保存失败：" + errText(e)); }
  }

  // ---------------- 秘密空间 ----------------
  function renderSecret() {
    var el = $("#page-more");
    if (!state.secretCode) {
      el.innerHTML = '<button class="back-btn" id="back-more">‹ 返回</button>' +
        '<div class="card secret-lock">' +
          '<div class="lock-icon">🔐</div>' +
          '<div class="section-title">设置你们的专属暗号</div>' +
          '<div class="muted" style="margin-bottom:12px">第一次进入，先定一个只有你们俩知道的暗号～</div>' +
          '<input id="secret-code-new" class="input" placeholder="输入暗号（比如：小鱼干）" maxlength="30">' +
          '<button id="btn-set-code" class="btn btn-primary btn-block">设定暗号</button>' +
        '</div>';
      $("#back-more").addEventListener("click", backToMore);
      $("#btn-set-code").addEventListener("click", setSecretCode);
      return;
    }

    if (!state.secretUnlocked) {
      el.innerHTML = '<button class="back-btn" id="back-more">‹ 返回</button>' +
        '<div class="card secret-lock">' +
          '<div class="lock-icon">🔐</div>' +
          '<div class="section-title">秘密空间</div>' +
          '<div class="muted" style="margin-bottom:12px">说出暗号，才放你进去～</div>' +
          '<input id="secret-code-input" class="input" placeholder="暗号" maxlength="30" type="password">' +
          '<button id="btn-unlock" class="btn btn-primary btn-block">进入</button>' +
        '</div>';
      $("#back-more").addEventListener("click", backToMore);
      $("#btn-unlock").addEventListener("click", unlockSecret);
      return;
    }

    var list = state.secrets.map(function (s) {
      return '<div class="secret-item">' + escapeHtml(s.content) +
        '<div class="secret-meta">' + escapeHtml(nicknameOf(s.author)) + ' · ' + escapeHtml(fmtDateTime(s.created_at)) + '</div></div>';
    }).join("");

    el.innerHTML = '<button class="back-btn" id="back-more">‹ 返回</button>' +
      '<div class="card">' +
        '<div class="card-title">🔒 秘密空间</div>' +
        '<textarea id="secret-content" class="input" placeholder="写到这里的悄悄话，只有我们俩能看到…"></textarea>' +
        '<button id="btn-add-secret" class="btn btn-primary btn-block">悄悄放进秘密空间</button>' +
        '<div class="tip" style="margin-top:10px">提示：这些内容存在你们的私有数据库里，只有登录的两个人能看。</div>' +
      '</div>' +
      (state.secrets.length ? list : '<div class="empty">还没有秘密，写下第一句吧</div>');

    $("#back-more").addEventListener("click", function () { state.secretUnlocked = false; backToMore(); });
    $("#btn-add-secret").addEventListener("click", addSecret);
    $("#secret-content").addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) addSecret();
    });
  }

  async function setSecretCode() {
    var code = $("#secret-code-new").value.trim();
    if (!code) { toast("暗号不能为空"); return; }
    try {
      var res = await sb.from("settings").upsert({ key: "secret_code", value: code });
      if (res.error) throw res.error;
      state.secretCode = code;
      state.secretUnlocked = true;
      renderSecret();
      toast("暗号设置好啦，记住它哦 🔐");
    } catch (e) { toast("设置失败：" + errText(e)); }
  }

  function unlockSecret() {
    var code = $("#secret-code-input").value.trim();
    if (code === state.secretCode) {
      state.secretUnlocked = true;
      renderSecret();
    } else {
      toast("暗号不对哦");
    }
  }

  async function addSecret() {
    var content = $("#secret-content").value.trim();
    if (!content) { toast("写点内容呀"); return; }
    try {
      var res = await sb.from("secrets").insert({ content: content, author: state.user.id });
      if (res.error) throw res.error;
      await loadSecrets();
      renderSecret();
      toast("都放进去了，只有你们俩能看到 💕");
    } catch (e) { toast("保存失败：" + errText(e)); }
  }

  // ---------------- 设置 ----------------
  function renderSettings() {
    var el = $("#page-more");
    var me = myProfile() || {};
    var monthOpts = "", dayOpts = "";
    for (var m = 1; m <= 12; m++) {
      var mNames = ["正月","二月","三月","四月","五月","六月","七月","八月","九月","十月","冬月","腊月"];
      monthOpts += '<option value="' + m + '"' + (me.lunar_month === m ? " selected" : "") + '>' + mNames[m - 1] + '</option>';
    }
    for (var d = 1; d <= 30; d++) {
      var dNames = ["初一","初二","初三","初四","初五","初六","初七","初八","初九","初十","十一","十二","十三","十四","十五","十六","十七","十八","十九","二十","廿一","廿二","廿三","廿四","廿五","廿六","廿七","廿八","廿九","三十"];
      dayOpts += '<option value="' + d + '"' + (me.lunar_day === d ? " selected" : "") + '>' + dNames[d - 1] + '</option>';
    }

    el.innerHTML = '<button class="back-btn" id="back-more">‹ 返回</button>' +
      '<div class="card">' +
        '<div class="card-title">⚙️ 个人资料</div>' +
        '<div class="form-row"><label class="field-label">你的昵称</label>' +
          '<input id="set-nickname" class="input" maxlength="12" placeholder="长乐 / 楠楠" value="' + escapeHtml(me.nickname || "") + '"></div>' +
        '<div class="form-row"><label class="field-label">农历生日</label>' +
          '<div class="row2"><select id="set-month" class="input">' + monthOpts + '</select>' +
          '<select id="set-day" class="input">' + dayOpts + '</select></div></div>' +
        '<button id="btn-save-profile" class="btn btn-primary btn-block">保存资料</button>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-title">🔐 密码 & 暗号</div>' +
        '<div class="muted">登录邮箱：' + escapeHtml(state.user.email || "") + '</div>' +
        '<div class="form-row" style="margin-top:10px"><label class="field-label">修改秘密空间暗号</label>' +
          '<input id="set-code" class="input" placeholder="新的暗号（留空则不改）" maxlength="30"></div>' +
        '<button id="btn-save-code" class="btn btn-blue btn-block">保存暗号</button>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-title">🚪 退出</div>' +
        '<button id="btn-logout" class="btn btn-danger btn-block">退出登录</button>' +
      '</div>';

    $("#back-more").addEventListener("click", backToMore);
    $("#btn-save-profile").addEventListener("click", saveProfile);
    $("#btn-save-code").addEventListener("click", saveSecretCode);
    $("#btn-logout").addEventListener("click", doLogout);
  }

  async function saveProfile() {
    var nickname = $("#set-nickname").value.trim();
    var month = parseInt($("#set-month").value, 10);
    var day = parseInt($("#set-day").value, 10);
    if (!nickname) { toast("昵称要填呀"); return; }
    try {
      var res = await sb.from("profiles").upsert({ id: state.user.id, nickname: nickname, lunar_month: month, lunar_day: day, updated_at: new Date().toISOString() });
      if (res.error) throw res.error;
      await loadProfiles();
      toast("资料保存好啦 💕");
      renderSettings();
    } catch (e) { toast("保存失败：" + errText(e)); }
  }

  async function saveSecretCode() {
    var code = $("#set-code").value.trim();
    if (!code) { toast("新暗号是空的，没改"); return; }
    try {
      var res = await sb.from("settings").upsert({ key: "secret_code", value: code });
      if (res.error) throw res.error;
      state.secretCode = code;
      toast("暗号已更新 🔐");
    } catch (e) { toast("保存失败：" + errText(e)); }
  }

  // ---------------- 启动 ----------------
  async function boot() {
    $("#topbar-date").textContent = todayLabel();

    if (!configured) {
      setAuthMsg("还没有配置：请先按 README 创建 Supabase，并把 URL / ANON KEY 填进 config.js");
    }

    $$(".tab").forEach(function (t) {
      t.addEventListener("click", function () { switchPage(t.dataset.page); });
    });
    $("#btn-login").addEventListener("click", doLogin);
    $("#btn-signup").addEventListener("click", doSignup);
    $("#auth-password").addEventListener("keydown", function (ev) { if (ev.key === "Enter") doLogin(); });
    $("#modal-close").addEventListener("click", hideModal);
    $(".modal-backdrop").addEventListener("click", hideModal);

    if (!sb) return;

    var sessionRes = await sb.auth.getSession();
    var session = sessionRes.data && sessionRes.data.session;
    if (session) {
      state.user = session.user;
      $("#auth-view").classList.add("hidden");
      $("#app-view").classList.remove("hidden");
      await loadAll();
    }

    sb.auth.onAuthStateChange(function (event, session2) {
      if (event === "SIGNED_IN" && session2 && !state.user) {
        state.user = session2.user;
        $("#auth-view").classList.add("hidden");
        $("#app-view").classList.remove("hidden");
        loadAll();
      }
      if (event === "SIGNED_OUT") {
        state.user = null;
        $("#app-view").classList.add("hidden");
        $("#auth-view").classList.remove("hidden");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
