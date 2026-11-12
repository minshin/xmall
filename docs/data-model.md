# 数据模型

现阶段在 `src/data/*.ts` 中以 TypeScript 种子数据维护，类型定义在 `src/lib/types.ts`。迁移到 Supabase 时一张类型对应一张表（ULID 主键）。

## 商品目录（DB，v0.4 起）

目录在 Supabase（Postgres），管理后台 `/admin` 编辑。读取：`lib/repo-catalog.ts`（SQL）→ `lib/catalog-server.ts`（`"use cache"`＋标签 `catalog`）。类型在 `src/lib/types.ts`。

| 表 | 说明 | 关键字段 |
| --- | --- | --- |
| `categories` | 品类（ノートPC・モニター・タブレット…） | id（如 `laptop`）, name, icon, sort |
| `spec_attributes` | 每个品类的规格项定义 | category_id, key, label, unit, type（text/number/boolean/enum）, scope（product＝机型一个值／variant＝每个配置）, options, icon, filterable（列表筛选）, highlight（卡片・机型页上部显示）, sort |
| `sites` | 厂商・购买渠道・租赁公司（带 favicon） | id（=`SHOPS` 的 shopId / 租赁公司 id）, name, kind（maker/shop/rental/other）, url, favicon_id |
| `products` | 机型（SPU） | slug, category_id, brand_id（→ sites, kind=maker）, name, subtitle（如 M5）, release_date, status（draft/published/archived）, verified, body_color, uses[], supplier_ids[]（样本供应商）, content（jsonb：summary・goodFor・notFor・scenes・choose・faqs・related）, sources（jsonb） |
| `product_specs` | 机型 × 规格项的值 | value（jsonb）, display（显示用文字，空则按值＋单位）, plain（白话解说） |
| `product_variants` | 配置（SKU 相当） | code（如 `16-512`，URL・询价用）, label, attrs（jsonb，variant 规格项的值）, official_price, rent_base, note, sort |
| `media` | Storage 桶 `media` 中的图片 | path, mime, bytes, width, height, alt, credit（出处・版权）, kind（product/favicon/other） |
| `product_media` | 机型的图片（多图，sort 是顺序，第 1 张是代表图） | product_id, media_id, sort |

- 只有 `status = published` 的机型出现在公开页・API・MCP。
- 页面上用的 `Device` 类型由 `toDevice()` 把上面几张表组装而成（specs 已展开规格项定义）。
- 计算用的等级・模板・样本供应商・商店仍在 `src/data/master.ts`（`SUPPLIERS` 是虚构样本，签约后改为 DB）。
- 初始数据：`src/data/devices.ts`（旧的笔记本专用形状 `SeedDevice`，不含图片）→ `npm run catalog:seed`。
- 图片素材不进代码库：只在 Storage＋`media` 表。备份・迁移用 `npm run media:export / media:import`（manifest.json＋文件，按商品 slug・网站 id 重新关联）。

## 会员（Supabase Auth）

| 表 | 说明 | 关键字段 |
| --- | --- | --- |
| `auth.users` | Supabase Auth 管理（邮箱＋密码、Google） | — |
| `profiles` | 与 auth.users 1:1，注册时由触发器 `handle_new_user` 创建 | email, role（user/editor/admin）, full_name, company_name, department, phone, company_size, last_seen_at |

- editor：商品・品类・网站・图片・口碑・询价；admin：再加会员权限、删除。
- 登录中的行为在 `device_views` / `device_likes` / `reviews` / `inquiries` 的 `user_id` 上留记录（未登录为 null，只有访客 Cookie）。

## 计算规则（`src/lib/pricing.ts`）

- 月租 = `rentBase × grade.priceFactor × termFactor × supplier.priceFactor + template.monthlyFee`，按 10 日元取整
- 租期系数：12 个月 1.22、24 个月 1.00、36 个月 0.88
- 实际购买价 = 价格 − 积分
- 买的净成本 = 实际购买价 −（实际购买价 × 转卖残值率）；残值率：12 个月 60%、24 个月 45%、36 个月 32%（样本假设）
- 租的总额 = 最低月租（A 级、一般事务模板）× 月数

以上系数都是样本假设，接入真实报价后删除。


## 数据库（Supabase / Postgres）

用户写入的数据和抓取来的租赁公司掲載价格（商品目录与会员见上）。结构见 `supabase/migrations/`。

| 表 | 内容 | 键 |
|---|---|---|
| `device_likes` | 点赞（気になる） | (device_slug, visitor_id) |
| `reviews` | 口碑。`status`: pending → approved / rejected；`is_sample` 标样本 | id (uuid) |
| `review_helpful` | 参考になった | (review_id, visitor_id) |
| `inquiries` | 询价：报价条件快照（服务器重算的金额）+ 联系方式；`status`: new → forwarded → closed | id (uuid) |
| `device_views` | 机型页的阅览者（每个访客 ID 一行；view_count・last_viewed_at・user_id） | (device_slug, visitor_id) |
| `device_stats`（视图） | 每机型收藏数（likes）、已公开口碑数、平均分、阅览者数（views） | device_slug |
| `rental_companies` | 实在租赁公司（非合作方）：服务名、运营公司、对象（business / mixed） | id（如 `rentio`） |
| `rental_listings` | 各公司公开页面上的商品：标题、厂商、CPU、内存、存储、OS、新旧、Office、库存、税区分、条件、对应的目录机型 `device_slug`/`config_id`、取得日、`active` | id (uuid)，唯一 (company_id, external_id) |
| `rental_prices` | 每个商品的期间价格：`term_unit`(day/month)・`term_value`・`price_yen`・`basis`（total＝期间合计／per_month＝该期间的月额）・页面原文 `label` | (listing_id, term_unit, term_value) |

- `device_slug` 对应 `products.slug`（为了改 slug 时不丢历史，没有加外键）。
- `visitor_id`：httpOnly Cookie `xm_vid` 里的随机 UUID，用于去重和限流，不做追踪。
- 访问只从服务器（postgres 角色）进行；全部表开 RLS 且无 policy。

### 实在租赁公司掲載价格的流程

1. `npm run rentals:scrape`：`scripts/rentals/sites/*` 抓取各公司公开页面 → `supabase/data/rental-listings.json`（类型 `RentalListingData`，在 git 里审阅差异）
2. `npm run rentals:import`：upsert 到 `rental_*` 表；某公司这次没抓到的商品标 `active=false`
3. 页面：只在机型页价格区「各社の掲載価格」显示 `device_slug` 对应的商品（favicon＋月额＋外链，默认 4 条）。不做全量一览页。缓存标签 `rentals`（`cacheLife("hours")`）

- 对应目录机型只在机型名＋世代明确一致时才填（规则在 `scripts/rentals/lib.ts` 的 `RULES`）。
- 税区分：`incl`／`excl`／`unknown`（页面没写就是 unknown，不换算）。
- 与 `SUPPLIERS`（虚构样本，按系数算报价）是两套东西；签下合作方后再合并。
