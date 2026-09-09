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
  introduce  text,
  nickname   jsonb,
  created_at timestamptz not null default now()
);

create index if not exists members_created_at_idx
  on public.members (created_at desc);

-- 已有数据库若缺少 dob 列，执行以下语句：
-- alter table public.members add column if not exists dob date;
-- alter table public.members add column if not exists introduce text;
-- alter table public.members add column if not exists nickname jsonb;

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
  remind_time text[],
  updated_at  timestamptz not null default now()
);

-- 已有数据库若缺少列，执行：
-- alter table public.event_remind add column if not exists channel_id text;
-- alter table public.event_remind add column if not exists remind_time text[];

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

-- 兑换码提醒默认配置
insert into public.event_remind (event_code, remind)
values ('CODES', false)
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

-- ============================================================
-- 兑换码（codes）— 若已有表可跳过
-- ============================================================
-- create table if not exists public.codes (
--   id          uuid primary key default gen_random_uuid(),
--   code        text not null,
--   created_at  timestamptz not null default now()
-- );
--
-- alter table public.codes enable row level security;
-- create policy "authenticated_full_access"
--   on public.codes for all to authenticated
--   using (true) with check (true);

-- ============================================================
-- 关键词触发 / 随机回复（keyword_triggers）
-- ============================================================
create table if not exists public.keyword_triggers (
  id          bigserial primary key,
  keyword     text not null,
  channel_ids jsonb not null default '[]'::jsonb,
  personality text not null,
  percentage  numeric not null default 0,
  status      smallint not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  text default 'admin'
);

create index if not exists idx_keyword_triggers_keyword
  on public.keyword_triggers (keyword);
create index if not exists idx_keyword_triggers_status
  on public.keyword_triggers (status);

create or replace function public.update_keyword_triggers_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_keyword_triggers_updated_at on public.keyword_triggers;
create trigger update_keyword_triggers_updated_at
  before update on public.keyword_triggers
  for each row
  execute function public.update_keyword_triggers_updated_at();

alter table public.keyword_triggers enable row level security;

drop policy if exists "authenticated_full_access" on public.keyword_triggers;
create policy "authenticated_full_access"
  on public.keyword_triggers
  for all
  to authenticated
  using (true)
  with check (true);

-- 已有表若缺少 percentage 列，执行：
-- alter table public.keyword_triggers add column if not exists percentage numeric not null default 0;

-- ============================================================
-- 公告（announcements）
-- date: jsonb 存周几数组，如 [1,3,5]（1=周一 … 7=周日）
-- time: text 存 HH:MM
-- ============================================================
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  content     text not null,
  date        jsonb not null default '[]'::jsonb,
  time        text not null default '',
  channel_id  text,
  status      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists announcements_created_at_idx
  on public.announcements (created_at desc);

alter table public.announcements enable row level security;

drop policy if exists "authenticated_full_access" on public.announcements;
create policy "authenticated_full_access"
  on public.announcements
  for all
  to authenticated
  using (true)
  with check (true);

-- 已有表若缺少 channel_id 列，执行：
-- alter table public.announcements add column if not exists channel_id text;

-- ============================================================
-- 陪聊（companion_chats）
-- 每个 channel_id 只能有一条设置。
-- 打开开关时写入 enabled_at，expires_at = enabled_at + duration_minutes。
-- Bot：若 enabled 且 expires_at <= now()，把 enabled 改为 false，并清空 enabled_at / expires_at。
-- ============================================================
create table if not exists public.companion_chats (
  id                uuid primary key default gen_random_uuid(),
  channel_id        text not null unique,
  prompt            text not null default '',
  enabled           boolean not null default false,
  reply_rate        numeric not null default 100,
  duration_minutes  integer not null default 60,
  enabled_at        timestamptz,
  expires_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists companion_chats_expires_at_idx
  on public.companion_chats (expires_at)
  where enabled = true;

create or replace function public.update_companion_chats_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_companion_chats_updated_at on public.companion_chats;
create trigger update_companion_chats_updated_at
  before update on public.companion_chats
  for each row
  execute function public.update_companion_chats_updated_at();

alter table public.companion_chats enable row level security;

drop policy if exists "authenticated_full_access" on public.companion_chats;
create policy "authenticated_full_access"
  on public.companion_chats
  for all
  to authenticated
  using (true)
  with check (true);
