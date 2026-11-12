# CLAUDE.md — xmall.jp

本文件是项目的锚点。开工前先读这里，再按需读 `docs/`。

## 一句话

xmall.jp 是面向日本法人的 **IT设备 租赁＋购买 比价网站**。我们只做流量和品牌：
标准化的设备目录 + 高质量内容（SEO/GEO）+ 给 AI 用的 MCP 接口；
租赁服务由合作租赁公司提供，购买走 Amazon・楽天・厂商直营等联盟链接。

## 原则

1. **内容是生命线**：每个机型页都要有独有数据（多家报价、价格、口碑）和详尽解说（规格白话、场景、选法、FAQ）。不做空洞的批量页面。
2. **事实必须可核对**：规格、官方价格只写有出处的；拿不准的写"以官方规格为准"，不编数字。出处写进数据（`sources` 字段）。
3. **我们不碰货和钱的风险**：不持有设备、不承担坏账。平台是撮合方。
4. **ステマ規制**：联盟链接、合作方委托的口碑必须明示（页面上已有"広告"标注和口碑标识）。
5. **结构化优先**：目录与解说内容来自 `src/data/` 的类型化数据（随 git 审阅），页面、JSON-LD、REST API、MCP 读同一份数据。
6. **DB 只放用户写入的东西**：点赞、口碑、"参考になった"、询价存 Supabase（Postgres）。只从服务器访问（`postgres` 驱动直连），所有表开 RLS 且不建 policy，anon key 读不到。

## 技术栈

- Next.js 16（App Router, Turbopack）、React 19、TypeScript、Tailwind CSS v4
- 目录数据：`src/data/*.ts`；用户数据：Supabase（本地用 Supabase CLI，`supabase/migrations/`）
- 表单：Server Actions + zod（`src/lib/validation.ts`），服务器端重算报价，不信任客户端金额
- 缓存：`cacheComponents`。读 DB 用 `"use cache"` + `cacheTag`，写入后在 Action 里 `updateTag`；读 Cookie 的部分放 `<Suspense>` 里
- 部署目标：Cloudflare / Fly.io Tokyo（未定）
- 测试：`npm test`（Node 内置 test runner + tsx）

## 目录

```
src/
  app/
    page.tsx                  首页＝商品目录（左侧筛选）
    pc/[slug]/page.tsx        机型详情（租/买比价、解说、FAQ、口碑）
    api/devices/...           REST API
    api/mcp/route.ts          MCP 端点（JSON-RPC, Streamable HTTP 无状态）
    inquiry/                  询价表单（/inquiry?device=…）与完成页
    admin/                    管理后台（Basic 认证：口碑审核、询价处理）
    actions.ts                公开的 Server Actions（点赞、参考になった、口碑、询价）
    sitemap.ts robots.ts llms.txt/route.ts privacy/
  proxy.ts                    /admin 的 Basic 认证
  components/                 UI 组件（客户端交互组件以 "use client" 标明）
  data/                       目录数据：devices, master（等级・模板・供应商・商店）
  lib/                        领域逻辑：pricing、catalog、jsonld、mcp
                              db（连接）、repo（纯 SQL，可测）、community（带缓存的读取＋访客 Cookie）、validation
supabase/                     config.toml、migrations/、seed.sql（本地样本口碑）
tests/                        领域逻辑与 MCP 的测试
docs/                         概念、数据模型、内容规范、MCP 规格、路线图
```

## 常用命令

```sh
npm install
cp .env.example .env.local
npm run db:start   # 本地 Supabase（需 Docker），首次会自动跑 migrations + seed
npm run dev        # http://localhost:3000   管理后台 /admin
npm test           # 设了 TEST_DATABASE_URL（库名以 _test 结尾）时也跑 DB 测试
npm run db:reset   # 重建本地库
npm run build
```

## 约定

- 页面文案用日语；文档用中文；代码注释日语・中文均可。
- 价格统一为日元整数（税込）。租金为每台每月。
- 样本数据（虚构的租赁公司、商店价格、口碑）必须在页面上标"サンプル"，上线前替换为真实数据。
- 改数据模型时同步更新 `docs/data-model.md` 和 MCP 的 schema。
- 改 DB 结构：新建 `supabase/migrations/<时间戳>_<名字>.sql`，不改已有 migration。
- 每个 Server Action 自己做校验和权限检查（管理用 Action 用 `isAdminAuthorized`）。
