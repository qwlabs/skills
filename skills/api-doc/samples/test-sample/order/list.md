### 订单查询接口
- 提供方: WMS系统
- 接口协议: HTTP
- 请求路径: /api/orders
- 请求方法: GET

## 请求参数 (Schema)
```yaml
type: object
properties:
  page:
    type: integer
    description: 页码
    default: 1
  pageSize:
    type: integer
    description: 每页条数
    default: 20
    maximum: 100
  orderNo:
    type: string
    description: 订单号
  status:
    type: string
    description: 订单状态
    enum: [pending, processing, completed, cancelled]
required: [page]
```

## 请求示例
```json
{
  "page": 1,
  "pageSize": 20,
  "status": "pending"
}
```

## 响应参数 (Schema)
```yaml
type: object
properties:
  code:
    type: integer
    description: 状态码
  data:
    type: object
    properties:
      list:
        type: array
        items:
          type: object
          properties:
            orderNo:
              type: string
              description: 订单号
            amount:
              type: number
              description: 订单金额
            status:
              type: string
              description: 状态
```

## 响应示例
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "orderNo": "ORD20250412001",
        "amount": 1000.00,
        "status": "pending"
      }
    ]
  }
}
