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
5. **结构化优先**：商品目录（品类・规格项・商品・配置・图片・解说）在 DB，管理后台 `/admin` 编辑；页面、JSON-LD、REST API、MCP 都经 `lib/catalog-server.ts` 读同一份数据。规格按品类在 `spec_attributes` 定义，不在代码里写死某个品类的字段。
6. **数据都在 Supabase，只从服务器访问**：DB 用 `postgres` 驱动直连，所有表开 RLS 且不建 policy，anon key 读不到。Supabase Auth 只用来登录（会话 Cookie），Storage 的 `media` 桶放图片（公开读、只有服务器用 service role 写）。`src/data/devices.ts` 只是初始数据和测试固定数据。
7. **抓取外部网站要守规矩**：只抓 robots.txt 允许的页面、同一主机间隔 ≥1.5 秒、只取页面上写明的值（读不出就 null，不推测）、价格的税区分照页面写。非合作公司只在机型页的价格区以紧凑行展示（favicon＋月额＋外链），不单独列页面，不走我们的询价表单。
8. **设计：Apple 风格、少字多图**：配色・形状用 `globals.css` 的 token（apple.com 取值）；图标用 `lucide-react`；说明文字能折叠就折叠、能用图标就不用句子；动效只做轻微的（hover 上浮、心形 pop、淡入），并尊重 `prefers-reduced-motion`。商品图用高清实拍（`Device.images`，多图），没有图才用插画。

## 技术栈

- Next.js 16（App Router, Turbopack）、React 19、TypeScript、Tailwind CSS v4
- 数据：Supabase（Postgres・Auth・Storage。本地用 Supabase CLI，`supabase/migrations/`）
- 会员：Supabase Auth（邮箱＋密码、Google），`@supabase/ssr`；`profiles.role` = user / editor / admin
- 权限：`/admin` 在 `proxy.ts` 先挡（非 editor 返回 404），每个页面和 Server Action 再用 `requireRole` 检查
- 表单：Server Actions + zod（`src/lib/validation.ts`），服务器端重算报价，不信任客户端金额
- 缓存：`cacheComponents`。读 DB 用 `"use cache"` + `cacheTag`，写入后在 Action 里 `updateTag`；读 Cookie 的部分放 `<Suspense>` 里
- 部署目标：Cloudflare / Fly.io Tokyo（未定）
- 测试：`npm test`（Node 内置 test runner + tsx）

## 目录

```
src/
  app/
    page.tsx                  首页＝商品目录（顶部筛选标签＋图卡网格）
    pc/[slug]/page.tsx        机型详情（租/买比价、解说、FAQ、口碑）
    api/devices/...           REST API
    api/mcp/route.ts          MCP 端点（JSON-RPC, Streamable HTTP 无状态）
    inquiry/                  询价表单（/inquiry?device=…）与完成页
    admin/                    管理后台：概要・商品（规格/配置/图片/解说）・品类与规格项・网站与 favicon・图片库・会员・口碑・询价
    login/ signup/ auth/      登录・注册・密码重置・回调（邮件确认/OAuth）
    account/                  会员页（公司信息・收藏・最近看过・改密码）
    actions.ts                公开的 Server Actions（点赞、参考になった、口碑、询价、阅览）
    auth-actions.ts           登录相关的 Server Actions
    sitemap.ts robots.ts llms.txt/route.ts privacy/
  proxy.ts                    刷新登录会话；/admin・/account 未登录→登录页；/admin 非 editor→404
  components/                 UI 组件（客户端交互组件以 "use client" 标明）
  data/                       初始数据 devices（只用于 catalog:seed 与测试）、master（等级・模板・样本供应商・商店）
  lib/                        领域逻辑：pricing、catalog（纯函数）、catalog-server（带缓存的读取）、jsonld、mcp
                              db（连接）、repo / repo-catalog / repo-admin / repo-accounts（纯 SQL，可测）
                              community（口碑等的缓存读取＋访客 Cookie）、auth（当前会员・权限）、storage（上传到 Storage）
                              validation / validation-admin（zod）
scripts/rentals/              实在租赁公司掲載价格的抓取（sites/ 每家一个解析器）与导入
scripts/favicons.ts           抓取 favicon → supabase/seed-assets/favicons/
scripts/catalog-seed.ts       初始数据（src/data/devices.ts＋seed-assets 的图片）→ DB・Storage
scripts/admin-grant.ts        给会员加 admin / editor 权限（建第一个管理员用）
supabase/                     config.toml、migrations/、seed.sql（本地样本口碑）、data/rental-listings.json（抓取结果）、seed-assets/（初始图片・favicon）
tests/                        领域逻辑与 MCP 的测试
docs/                         概念、数据模型、内容规范、MCP 规格、路线图
```

## 常用命令

```sh
npm install
cp .env.example .env.local
npm run db:start   # 本地 Supabase（需 Docker），首次会自动跑 migrations + seed
npm run catalog:seed     # 初始商品・网站・图片写入 DB 和 Storage（首次）
npm run admin:grant -- you@example.com   # 先在 /signup 注册，再给自己 admin 权限
npm run dev        # http://localhost:3000   管理后台 /admin   本地邮件 http://127.0.0.1:55324
npm test           # 设了 TEST_DATABASE_URL（库名以 _test 结尾）时也跑 DB 测试
npm run db:reset   # 重建本地库（之后需再跑 catalog:seed・rentals:import，并重新注册管理员）
npm run rentals:scrape   # 抓取各租赁公司公开页面 → supabase/data/rental-listings.json
npm run rentals:import   # 把 JSON 导入 DB（upsert；消失的商品标 active=false）
npm run favicons         # 重新抓 favicon 到 seed-assets（之后 catalog:seed；或在后台直接上传）
npm run build
```

## 约定

- 页面文案用日语；文档用中文；代码注释日语・中文均可。
- 价格统一为日元整数（税込）。租金为每台每月。例外：实在租赁公司的掲載价格按页面原样保存，税区分记在 `price_tax`，页面上照样标注。
- 样本数据（虚构的租赁公司、商店价格、口碑）必须在页面上标"サンプル"，上线前替换为真实数据。
- 改数据模型时同步更新 `docs/data-model.md`、`src/lib/types.ts` 和 MCP 的 schema。
- 改了商品目录（后台的 Action）要 `updateTag(CATALOG_TAG)`，公开页才会更新。
- 改 DB 结构：新建 `supabase/migrations/<时间戳>_<名字>.sql`，不改已有 migration。
- 每个 Server Action 自己做校验和权限检查（管理用 Action 用 `requireRole("editor" | "admin")`）。
