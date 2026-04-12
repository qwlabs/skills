---
metadata:
  provider:  { value: WMS, render: text, title: 提供方 }
  protocol:  { value: HTTP, render: badge, title: 接口协议 }
  path:      { value: /orbit/modeling/webApi, render: code, title: 请求路径 }
  method:    { value: POST, render: tag, title: 请求方法 }
---

### 整体说明

- 库存物料类型编码清单

| 物料类型编码 | 物料类型名称 |
|------------|-------------|
| RAW | 原材料 |
| TOOL | 工装 |
| METER | 计量器具 |
| SPARE | 备品备件 |
| CONSUME | 低值易耗品 |
| PRD | 产成品 |
| BYP | 联副产品 |
| SCRAP | 废品废料 |

- 分组: 基础数据
  - 仓库管理
  - 库存管理
- 分组: 入库
  - 入库单管理
- 分组: 出库
  - 出库单管理
- 分组: 调拨
  - 调拨单管理
