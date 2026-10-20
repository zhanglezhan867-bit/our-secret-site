-- ============================================================
-- 长乐 & 楠楠 的秘密小站 —— Supabase 数据库初始化
-- 用法：Supabase 控制台 → SQL Editor → 新建查询 → 粘贴全部 → Run
-- ============================================================

-- 1) 个人资料（昵称 + 农历生日）
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  lunar_month int,
  lunar_day int,
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles read" on public.profiles;
drop policy if exists "profiles insert" on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles update" on public.profiles for update to authenticated using (id = auth.uid());

-- 2) 照片墙
create table if not exists public.photos (
  id bigint generated always as identity primary key,
  path text not null,
  caption text,
  uploader uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
alter table public.photos enable row level security;
drop policy if exists "photos read" on public.photos;
drop policy if exists "photos insert" on public.photos;
drop policy if exists "photos delete" on public.photos;
create policy "photos read" on public.photos for select to authenticated using (true);
create policy "photos insert" on public.photos for insert to authenticated with check (true);
create policy "photos delete" on public.photos for delete to authenticated using (true);

-- 3) 文字 / 日记
create table if not exists public.notes (
  id bigint generated always as identity primary key,
  title text,
  content text not null,
  author uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
alter table public.notes enable row level security;
drop policy if exists "notes read" on public.notes;
drop policy if exists "notes insert" on public.notes;
drop policy if exists "notes delete" on public.notes;
create policy "notes read" on public.notes for select to authenticated using (true);
create policy "notes insert" on public.notes for insert to authenticated with check (true);
create policy "notes delete" on public.notes for delete to authenticated using (true);

-- 4) 聊天记录（文字 + 截图）
create table if not exists public.chats (
  id bigint generated always as identity primary key,
  sender text,
  content text,
  sent_at timestamptz default now(),
  image_path text,
  created_at timestamptz default now()
);
alter table public.chats enable row level security;
drop policy if exists "chats read" on public.chats;
drop policy if exists "chats insert" on public.chats;
drop policy if exists "chats delete" on public.chats;
create policy "chats read" on public.chats for select to authenticated using (true);
create policy "chats insert" on public.chats for insert to authenticated with check (true);
create policy "chats delete" on public.chats for delete to authenticated using (true);

-- 5) 情侣问答答案
create table if not exists public.answers (
  id bigint generated always as identity primary key,
  question_id int not null,
  user_id uuid references auth.users(id) on delete cascade,
  answer text,
  updated_at timestamptz default now(),
  unique (question_id, user_id)
);
alter table public.answers enable row level security;
drop policy if exists "answers read" on public.answers;
drop policy if exists "answers upsert" on public.answers;
drop policy if exists "answers update" on public.answers;
create policy "answers read" on public.answers for select to authenticated using (true);
create policy "answers upsert" on public.answers for insert to authenticated with check (user_id = auth.uid());
create policy "answers update" on public.answers for update to authenticated using (user_id = auth.uid());

-- 6) 秘密空间
create table if not exists public.secrets (
  id bigint generated always as identity primary key,
  content text not null,
  author uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
alter table public.secrets enable row level security;
drop policy if exists "secrets read" on public.secrets;
drop policy if exists "secrets insert" on public.secrets;
drop policy if exists "secrets delete" on public.secrets;
create policy "secrets read" on public.secrets for select to authenticated using (true);
create policy "secrets insert" on public.secrets for insert to authenticated with check (true);
create policy "secrets delete" on public.secrets for delete to authenticated using (true);

-- 7) 小站设置（暗号等）
create table if not exists public.settings (
  key text primary key,
  value text
);
alter table public.settings enable row level security;
drop policy if exists "settings read" on public.settings;
drop policy if exists "settings upsert" on public.settings;
drop policy if exists "settings update" on public.settings;
create policy "settings read" on public.settings for select to authenticated using (true);
create policy "settings upsert" on public.settings for insert to authenticated with check (true);
create policy "settings update" on public.settings for update to authenticated using (true);

-- 8) 照片存储桶（私有，仅登录用户可读写）
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "photos storage read" on storage.objects;
drop policy if exists "photos storage insert" on storage.objects;
drop policy if exists "photos storage delete" on storage.objects;
create policy "photos storage read" on storage.objects
  for select to authenticated using (bucket_id = 'photos');
create policy "photos storage insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');
create policy "photos storage delete" on storage.objects
  for delete to authenticated using (bucket_id = 'photos');

-- 完成！接下来在 Authentication → Users 里创建你们俩的账号（见 README）
