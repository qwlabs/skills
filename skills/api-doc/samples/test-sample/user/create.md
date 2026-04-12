### 创建用户接口
- 提供方: WMS系统
- 接口协议: HTTP
- 请求路径: /api/users
- 请求方法: POST
- 应用场景:
  - 新增系统用户
  - 批量导入用户
- 请求前置条件:
  - 当前用户有创建权限

## 请求参数 (Schema)
```yaml
type: object
properties:
  name:
    type: string
    description: 用户名称
    maxLength: 50
    required: true
  email:
    type: string
    description: 邮箱地址
    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
    required: true
  phone:
    type: string
    description: 手机号
    pattern: "^1[3-9]\\d{9}$"
  role:
    type: string
    description: 角色
    enum: [admin, user, guest]
    default: user
  status:
    type: string
    description: 状态
    enum: [active, inactive]
    default: active
required: [name, email]
```

## 请求示例
```json
{
  "name": "李四",
  "email": "li@example.com",
  "phone": "13800138000",
  "role": "user",
  "status": "active"
}
```

## 响应参数 (Schema)
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
    description: 创建的用户信息
    properties:
      id:
        type: integer
        description: 用户ID
      name:
        type: string
        description: 用户名
      createdAt:
        type: string
        description: 创建时间
```

## 响应示例
```json
{
  "code": 200,
  "message": "创建成功",
  "data": {
    "id": 100,
    "name": "李四",
    "createdAt": "2025-04-12 18:00:00"
  }
}
