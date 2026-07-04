# 后台管理系统

一个基于 **Next.js (App Router) + TypeScript + Tailwind CSS + Supabase** 的简单后台管理系统。

## 功能

- 🔐 **登录鉴权**：使用 Supabase Auth（邮箱 + 密码），中间件保护后台路由
- 📊 **仪表盘**：成员数量、状态、角色等数据概览
- 👥 **成员管理**：成员的新增、编辑、删除、搜索（完整 CRUD）
- 🪪 **登录账号管理**：在后台直接创建 / 删除可登录的 Supabase Auth 账号（需 service_role 密钥）
- 🎨 现代简洁的管理界面

## 技术栈

| 层 | 技术 |
| --- | --- |
| 框架 | Next.js 15（App Router、Server Actions） |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v3 |
| 数据库 / 鉴权 | Supabase（Postgres + Auth） |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Supabase

1. 在 [supabase.com](https://supabase.com) 创建一个项目。
2. 打开项目的 **SQL Editor**，执行本仓库中的 [`supabase/schema.sql`](./supabase/schema.sql)，用于创建 `members` 表、行级安全策略以及示例数据。
3. 复制环境变量示例并填写：

```bash
cp .env.local.example .env.local
```

在 `.env.local` 中填入（可在 Supabase 控制台 **Project Settings → API** 找到）：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxx          # anon / public 公钥（会打包进前端）
SUPABASE_SERVICE_ROLE_KEY=xxxx              # service_role 私钥（仅服务端，切勿加 NEXT_PUBLIC_）
```

> ⚠️ **安全提醒**：`NEXT_PUBLIC_SUPABASE_ANON_KEY` 必须填 **anon / public** 公钥；`SUPABASE_SERVICE_ROLE_KEY` 才填 **service_role** 私钥，两者是不同的 key。绝对不要把 service_role 私钥填到任何带 `NEXT_PUBLIC_` 前缀的变量里，否则它会被打包进前端、任何访客都能拿到，等于整个数据库暴露。
>
> `SUPABASE_SERVICE_ROLE_KEY` 是可选的：不配置时后台其余功能正常，只是「登录账号」页无法直接创建用户（可改为去 Supabase 控制台手动建）。

### 3. 创建一个登录账户

后台使用 Supabase Auth 登录。在 Supabase 控制台 **Authentication → Users → Add user** 中新增一个用户（邮箱 + 密码），即可用它登录后台。

> 提示：为方便测试，可在 **Authentication → Providers → Email** 中关闭 “Confirm email”，这样新建用户无需邮箱验证即可登录。

### 4. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)，会自动跳转到登录页。使用第 3 步创建的账户登录即可进入后台。

## 目录结构

```
src/
├── app/
│   ├── login/                 # 登录页 + 登录 Server Action
│   ├── auth/actions.ts        # 退出登录
│   ├── dashboard/
│   │   ├── layout.tsx         # 后台布局（侧边栏 + 顶部栏，鉴权）
│   │   ├── page.tsx           # 仪表盘
│   │   ├── members/           # 成员管理页 + CRUD Server Actions
│   │   └── users/             # 登录账号管理页 + Server Actions（service_role）
│   ├── layout.tsx
│   └── page.tsx               # 根路径重定向到 /dashboard
├── components/                # 侧边栏、表格、弹窗、徽章等 UI 组件
├── lib/
│   ├── supabase/              # Supabase 浏览器端 / 服务端 / 中间件 / admin 客户端
│   └── types.ts               # 数据类型与中文标签
└── middleware.ts              # 会话刷新 + 路由保护
supabase/
└── schema.sql                 # 数据库初始化脚本
```

## 构建部署

```bash
npm run build
npm run start
```

可直接部署到 Vercel，记得在项目环境变量中配置 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。

## 说明

- 当前 RLS 策略为“所有已登录用户拥有全部权限”，适合内部后台的简单场景。若需要更细粒度的权限，请在 Supabase 中调整 `members` 表的策略。
- 由于本地 Node 版本为 18，样式使用 Tailwind CSS v3（Tailwind v4 需要 Node 20+）。
