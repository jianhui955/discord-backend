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
  role       text not null default 'member'
             check (role in ('admin', 'moderator', 'member')),
  status     text not null default 'active'
             check (status in ('active', 'inactive', 'banned')),
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists members_created_at_idx
  on public.members (created_at desc);

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
