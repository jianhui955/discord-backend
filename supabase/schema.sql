-- ============================================================
-- 后台管理系统 - Supabase 数据库初始化脚本
-- 在 Supabase 控制台的 SQL Editor 中执行本文件
-- ============================================================

create extension if not exists "pgcrypto";

-- 成员表
create table if not exists public.members (
  id         uuid primary key default gen_random_uuid(),
  username   text not null,
  email      text,
  dob        date,
  role       text not null default 'member'
             check (role in ('admin', 'moderator', 'member')),
  status     text not null default 'active'
             check (status in ('active', 'inactive', 'banned')),
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists members_created_at_idx
  on public.members (created_at desc);

-- 已有数据库若缺少 dob 列，执行以下语句：
-- alter table public.members add column if not exists dob date;

-- 开启行级安全
alter table public.members enable row level security;

-- 简单场景：所有已登录用户拥有全部权限
drop policy if exists "authenticated_full_access" on public.members;
create policy "authenticated_full_access"
  on public.members
  for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- 种子数据（可选，首次执行时插入示例成员）
-- ============================================================
insert into public.members (username, email, role, status, note)
select * from (values
  ('alice', 'alice@example.com', 'admin',     'active',   '创始管理员'),
  ('bob',   'bob@example.com',   'moderator', 'active',   null),
  ('carol', 'carol@example.com', 'member',    'inactive', '待激活'),
  ('dave',  'dave@example.com',  'member',    'banned',   '违规封禁')
) as seed(username, email, role, status, note)
where not exists (select 1 from public.members);

-- ============================================================
-- 事件提醒开关（event_remind）
-- ============================================================
create table if not exists public.event_remind (
  id          uuid primary key default gen_random_uuid(),
  event_code  text not null unique,
  remind      boolean not null default false,
  channel_id  text,
  updated_at  timestamptz not null default now()
);

-- 已有数据库若缺少 channel_id 列：
-- alter table public.event_remind add column if not exists channel_id text;

alter table public.event_remind enable row level security;

drop policy if exists "authenticated_full_access" on public.event_remind;
create policy "authenticated_full_access"
  on public.event_remind
  for all
  to authenticated
  using (true)
  with check (true);

-- 生日提醒默认配置
insert into public.event_remind (event_code, remind)
values ('BIRTHDAY', false)
on conflict (event_code) do nothing;

-- ============================================================
-- 生日提醒模板（birthday_reminder_templates）
-- ============================================================
create table if not exists public.birthday_reminder_templates (
  id          uuid primary key default gen_random_uuid(),
  content     text not null,
  status      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists birthday_reminder_templates_created_at_idx
  on public.birthday_reminder_templates (created_at desc);

alter table public.birthday_reminder_templates enable row level security;

drop policy if exists "authenticated_full_access" on public.birthday_reminder_templates;
create policy "authenticated_full_access"
  on public.birthday_reminder_templates
  for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- Discord Stickers（sticker）— 若已有表可跳过
-- 用于生日提醒模板编辑时选择 sticker，点击后插入 pic_code
-- ============================================================
-- create table if not exists public.sticker (
--   id               uuid primary key default gen_random_uuid(),
--   pic_name         text not null,
--   pic_code         text not null,
--   pic_discord_id   text not null
-- );
--
-- alter table public.sticker enable row level security;
-- create policy "authenticated_full_access"
--   on public.sticker for all to authenticated
--   using (true) with check (true);
