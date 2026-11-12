# MCP 接口

端点：`POST /api/mcp`（JSON-RPC 2.0，Streamable HTTP 的无状态最小实现，返回 `application/json`）。
目录数据由 route 从 DB 读出（`getDevices()`）后传给 `handleMcpMessage`。
支持方法：`initialize`、`notifications/initialized`、`tools/list`、`tools/call`、`ping`。

## 工具

| 工具 | 作用 | 主要参数 |
| --- | --- | --- |
| `search_devices` | 按条件搜索机型（多品类） | query, category, brand, os, maxMonthlyRent, use, minMemoryGb |
| `get_device` | 获取机型详情（品类、规格与白话解说、配置、FAQ、出处） | slug |
| `compare_rental_offers` | 各租赁公司公开页面的掲載月额（安い順，含 URL・税区分・取得日） | slug, configId?, months? |
| `compare_purchase_prices` | 厂商直销价（有出处的） | slug, configId |
| `rent_or_buy` | 最安掲載月额×月数 vs 直销价 的单纯比较 | slug, configId, months |

v0.5 删除了基于虚构数据的 `get_quote`。

`create_inquiry`（提交咨询并转给租赁公司）待合作方接入后实现。

## 测试

```sh
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
