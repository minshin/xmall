# 数据模型

现阶段在 `src/data/*.ts` 中以 TypeScript 种子数据维护，类型定义在 `src/lib/types.ts`。迁移到 Supabase 时一张类型对应一张表（ULID 主键）。

## 实体

| 实体 | 说明 | 关键字段 |
| --- | --- | --- |
| Device（SPU） | 一个机型 | slug, brand, name, category, releaseDate, officialPriceFrom, specs[], configs[], content, sources[] |
| DeviceConfig | 机型下的硬件规格（内存/存储等） | id, label, memoryGb, storageGb, officialPrice, rentBase |
| Grade | 成色等级 S/A/B/C | code, label, appearance, batteryMin, warranty, priceFactor |
| Template | 配置模板（软件与初始设置） | code, label, monthlyFee, items[] |
| SKU | 计算得出：`{slug}-{config}-{grade}` + 模板 | — |
| Supplier | 租赁公司 | id, name, certified, rating, leadDays, swap, setupFee, priceFactor, grades |
| RentalOffer | 供应商对某 SKU 的月租报价 | 现阶段由 `lib/pricing.ts` 按系数计算；上线后改为供应商推送的真实报价 |
| Shop | 购买渠道 | id, name, kind（official/affiliate）, pointRate, shipping |
| ShopPrice | 某商店对某配置的价格 | 现阶段按系数计算；上线后由各商店 API 每日更新 |
| Review | 口碑 | deviceSlug, rating, author, usage, acquisition（rent/buy）, verified, body, helpful |
| Question | 提问（对所有人开放） | 待实现 |

## 计算规则（`src/lib/pricing.ts`）

- 月租 = `rentBase × grade.priceFactor × termFactor × supplier.priceFactor + template.monthlyFee`，按 10 日元取整
- 租期系数：12 个月 1.22、24 个月 1.00、36 个月 0.88
- 实际购买价 = 价格 − 积分
- 买的净成本 = 实际购买价 −（实际购买价 × 转卖残值率）；残值率：12 个月 60%、24 个月 45%、36 个月 32%（样本假设）
- 租的总额 = 最低月租（A 级、一般事务模板）× 月数

以上系数都是样本假设，接入真实报价后删除。


## 数据库（Supabase / Postgres）

只存用户写入的数据。结构见 `supabase/migrations/`。

| 表 | 内容 | 键 |
|---|---|---|
| `device_likes` | 点赞（気になる） | (device_slug, visitor_id) |
| `reviews` | 口碑。`status`: pending → approved / rejected；`is_sample` 标样本 | id (uuid) |
| `review_helpful` | 参考になった | (review_id, visitor_id) |
| `inquiries` | 询价：报价条件快照（服务器重算的金额）+ 联系方式；`status`: new → forwarded → closed | id (uuid) |
| `device_stats`（视图） | 每机型点赞数、已公开口碑数、平均分 | device_slug |

- `device_slug` 对应 `src/data/devices.ts` 的 slug（目录不在 DB，所以没有外键）。
- `visitor_id`：httpOnly Cookie `xm_vid` 里的随机 UUID，用于去重和限流，不做追踪。
- 访问只从服务器（postgres 角色）进行；全部表开 RLS 且无 policy。
