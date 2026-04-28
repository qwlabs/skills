import "@typespec/http";

import "./入库.tsp";
import "./出库.tsp";
import "./基础数据.tsp";

using TypeSpec.Http;

@doc("WMS 仓储管理系统")
@service(#{title: "WMS API"})
@route("/api")
namespace WMS;

model ApiResponse<T> {
  @doc("状态码")
  code: int32;

  @doc("消息")
  message: string;

  @doc("数据")
  data?: T;
}

model Error {
  code: int32;
  message: string;
}

model PageRequest {
  @doc("页码")
  page?: int32 = 1;

  @doc("每页数量")
  @maxValue(100)
  pageSize?: int32 = 20;
}

model PageResponse<T> {
  @doc("总数")
  total: int64;

  @doc("页码")
  page: int32;

  @doc("每页数量")
  pageSize: int32;

  @doc("数据列表")
  items: T[];
}
