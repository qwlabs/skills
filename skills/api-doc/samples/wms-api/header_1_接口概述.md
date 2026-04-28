# WMS 仓储管理系统 API

本文档描述了 WMS 仓储管理系统的全部 HTTP 接口。

## 认证方式

所有接口需要在请求头中携带 `Authorization: Bearer {token}`。

## 通用响应结构

- `code`: 状态码，200 表示成功
- `message`: 描述信息
- `data`: 业务数据（仅成功时返回）
