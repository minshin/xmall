# 路线图

## v0.1（本次）

- [x] 首页＝商品目录（品牌 / CPU / 内存 / 尺寸 / OS 筛选，排序）
- [x] 机型详情页：租/买比价、计算器、白话规格、场景、选法、FAQ、口碑、相近机型
- [x] JSON-LD（Product + AggregateOffer、FAQPage、BreadcrumbList）、sitemap、robots、llms.txt
- [x] REST API 与 MCP 端点
- [x] 样本数据：MacBook Pro 14（M5，已核对官方规格）+ 若干机型（内容待补）

## v0.2（本次）

- [x] Supabase 本地环境（CLI 配置、migrations、seed）
- [x] 点赞・"参考になった" 持久化（匿名访客 Cookie，无需登录）
- [x] 口碑投稿（审核后公开，每访客每天 3 条，蜜罐防 bot）
- [x] 询价流程：机型页 → /inquiry（服务器重算报价）→ 完成页
- [x] 管理后台 /admin：概要、口碑审核、询价处理（状态・内部备注）
- [x] 个人信息页（草稿，待法务确认）
- [ ] 主力 30–50 机型的完整内容（按 content-guidelines）
- [ ] 询价通知邮件（运营 + 租赁公司）
- [ ] 提问（Q&A）投稿

## v0.2.x（后置）

- [ ] Amazon アソシエイト / 楽天 / 直营联盟链接与价格每日更新

## v0.3

- [ ] 供应商后台（SKU 对应、报价、排名）
- [ ] 客户后台（设备台账、统一账单、到期提醒）
- [ ] MCP `create_inquiry`、“按月租”嵌入按钮
- [ ] 中文・韩文
