# 长乐 & 楠楠 的秘密小站 💕

一个只属于你们两个人的私密小站：照片墙、文字日记、聊天记录、农历生日倒计时、情侣问答、秘密空间。
纯前端 + **Supabase**（登录 / 数据库 / 照片存储），部署在公网上，**手机随时能打开、上传照片和文字**。

---

## 一、这个网站能做什么

| 功能 | 说明 |
|---|---|
| 🔐 双人登录 | 只有两个注册账号能进入，别人打不开 |
| 📷 照片墙 | 手机从相册直接上传，多张一起传，可删除、点开大图 |
| ✍️ 文字 / 日记 | 手机随时写，按时间排列 |
| 💬 聊天记录 | 粘贴文字（昵称：内容）批量导入；也可以上传聊天截图 |
| 🎂 生日倒计时 | 按**农历**生日自动换算，显示多少天、实时秒数，生日当天会变"🎂" |
| 🎮 情侣问答 | 30 道题，各自回答后能看到对方答案，显示双人答题进度 |
| 🔒 秘密空间 | 需要输入你们约定的暗号才能进入，存放只给对方看的话 |

---

## 二、文件结构

```
专属网站/
├── index.html            # 页面骨架
├── styles.css            # 样式（手机优先）
├── app.js                # 全部功能逻辑
├── config.js             # ⚠️ 要填 Supabase URL 和 Key（第 3 步）
├── lunar.js              # 农历换算库（离线）
├── vendor/supabase.js    # Supabase 客户端库（离线）
├── supabase-schema.sql   # 数据库建表脚本（第 2 步用）
└── README.md             # 本文件
```

---

## 三、部署步骤（约 15 分钟，全部免费）

### 第 1 步：注册 Supabase（用 GitHub 账号登录即可）

1. 打开 <https://supabase.com>，点 **Start your project**，用 GitHub 授权登录
2. 点 **New project**，随便起个名字（比如 `chang-le-nan-nan`）
3. 数据库密码随便设一个（**记下来**，以后用得上），区域选 **Singapore**（离国内近一点）
4. 等 1~2 分钟，项目创建好

### 第 2 步：初始化数据库

1. 左侧菜单点 **SQL Editor** → **New query**
2. 把 `supabase-schema.sql` 文件里的**全部内容**复制进去
3. 点 **Run**，显示 Success 就完成了

### 第 3 步：拿到 URL 和 Key，填进 config.js

1. 左侧 **Project Settings**（齿轮）→ **API**
2. 复制两个值：
   - **Project URL**（形如 `https://xxxx.supabase.co`）
   - **anon public key**（以 `eyJ` 开头的一长串）
3. 用记事本打开 `config.js`，把这两个值填进引号里：
   ```js
   window.APP_CONFIG = {
     SUPABASE_URL: "https://xxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOi...",
   };
   ```

> `anon key` 是设计成可以公开的，别人拿到它也读不到你们的数据——数据安全由 Supabase 的行级权限（RLS）保护。

### 第 4 步：创建你们俩的账号

1. 左侧 **Authentication** → **Sign In / Providers** → 把 **Email** 的 **Confirm email** 关掉（方便直接登录）
2. **Authentication** → **Users** → **Add user** → **Create new user**
3. 用邮箱+密码创建两个账号（比如 `changle@example.com`、`nannan@example.com`，邮箱不用真的能收信，格式对就行）
4. 创建后关闭注册入口（可选）：**Authentication** → **Sign In / Providers** → Email 里关闭 **Allow new users to sign up**

### 第 5 步：把网站部署到公网（有 GitHub 账号，选 A）

**A. GitHub Pages（推荐，免费）**

1. 打开 <https://github.com/new>，新建仓库，名字比如 `our-secret-site`，选 **Public**（代码公开没关系，数据在 Supabase）
2. 进入仓库 → **Add file** → **Upload files** → 把 `专属网站` 文件夹里的**全部文件**拖进去
   （注意：要把 `index.html` 放在仓库根目录，`vendor` 文件夹也要一起上传）
3. 点 **Commit changes**
4. 仓库 → **Settings** → **Pages** → Source 选 **Deploy from a branch** → Branch 选 **main**、目录选 **/(root)** → **Save**
5. 等 1 分钟，页面会显示网址：`https://你的用户名.github.io/our-secret-site/`

**B. Netlify Drop（更简单，不用 GitHub）**

1. 打开 <https://app.netlify.com/drop>
2. 把整个 `专属网站` 文件夹拖进去，几秒后得到网址

**C. Vercel**

1. 打开 <https://vercel.com>，用 GitHub 登录
2. **Add New → Project** → 导入刚才建的 GitHub 仓库 → Deploy

### 第 6 步：手机打开，各自登录

- 把网址发给对方（微信发链接即可）
- 两个人各自用**自己的账号**登录
- 第一次登录后，点「更多 → 个人资料与设置」，填上**昵称 + 农历生日**（比如 长乐 腊月初四、楠楠 六月初九）
- 首页的生日倒计时、问答、秘密空间就都能用了

---

## 四、隐私与安全

- 整个网站**必须登录**才能看到内容；照片存储桶是**私有**的，只有登录用户能读
- 秘密空间另有一道**暗号**（登录后再验证一次）
- `anon key` 公开不会泄露数据（RLS 权限限制），但**不要**把 Supabase 的 `service_role` key 放到前端
- 照片签名链接 1 小时后过期，刷新页面会自动重新签名
- 聊天记录、照片属于两个人的私密内容，**不要把网站链接和账号密码给第三个人**
- 建议定期在 Supabase 后台 **Database → Backups** 里确认备份开启

---

## 五、常见问题

**登录不了 / 提示邮箱未确认？**
→ 第 4 步里把 "Confirm email" 关掉，或者去 Authentication → Users 里手动确认那个邮箱。

**上传照片失败？**
→ 确认 `supabase-schema.sql` 全部跑完了（包括最后的存储桶和策略），并且当前已登录。

**照片显示不出来 / 裂图？**
→ 签名链接过期，刷新页面即可。

**生日倒计时不对？**
→ 检查"个人资料"里选的农历月日是否正确（腊月 = 十二月，初四 = 4）。

**想改网站名字/配色？**
→ 改 `index.html` 里的标题文字、`styles.css` 里的颜色变量（`:root` 里的 `--pink`、`--blue`）。

---

## 六、本地预览（可选）

在 `专属网站` 目录里执行（需要 Python）：

```bash
python -m http.server 8080
```

然后浏览器打开 <http://localhost:8080>。但**真正的手机上传、双人登录需要第 5 步部署到公网后才能完整使用**。
