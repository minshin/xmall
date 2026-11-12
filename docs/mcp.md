# MCP 接口

端点：`POST /api/mcp`（JSON-RPC 2.0，Streamable HTTP 的无状态最小实现，返回 `application/json`）。
支持方法：`initialize`、`notifications/initialized`、`tools/list`、`tools/call`、`ping`。

## 工具

| 工具 | 作用 | 主要参数 |
| --- | --- | --- |
| `search_devices` | 按条件搜索机型 | query, brand, os, maxMonthlyRent, use |
| `get_device` | 获取机型详情（规格、配置、白话解说、FAQ） | slug |
| `compare_rental_offers` | 比较某配置的各家月租 | slug, configId, grade, term, template |
| `compare_purchase_prices` | 比较某配置的各商店价格 | slug, configId |
| `rent_or_buy` | 计算买和租哪个划算 | slug, configId, term |
| `get_quote` | 按台数和租期计算总额 | slug, configId, grade, term, template, quantity, supplierId? |

`create_inquiry`（提交咨询并转给租赁公司）待合作方接入后实现。

## 测试

```sh
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
