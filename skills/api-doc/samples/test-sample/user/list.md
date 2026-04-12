---
title: 用户查询接口
metadata:
  method:      { value: GET, render: tag, title: 请求方法 }
---

## 应用场景
- 分页查询用户列表
- 根据条件筛选用户

## 请求前置条件
- 用户已登录

## 请求参数
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
required: [page]
```

## 请求示例
```json
{
  "page": 1,
  "pageSize": 20
}
```

## 响应参数
```yaml
type: object
properties:
  code:
    type: integer
    description: 状态码
  message:
    type: string
    description: 消息
  data:
    type: object
    description: 数据
    properties:
      total:
        type: integer
        description: 总数
      list:
        type: array
        description: 用户列表
        items:
          type: object
          properties:
            id:
              type: integer
              description: 用户ID
            name:
              type: string
              description: 用户名称
```

## 响应示例
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 100,
    "list": [
      { "id": 1, "name": "张三" }
    ]
  }
}
