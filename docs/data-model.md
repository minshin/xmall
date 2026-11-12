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
