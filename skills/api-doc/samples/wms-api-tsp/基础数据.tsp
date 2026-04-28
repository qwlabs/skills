namespace WMS.基础数据;

using TypeSpec.Http;

model Warehouse {
  @doc("仓库编码")
  code: string;

  @doc("仓库名称")
  name: string;

  @doc("仓库地址")
  address: string;

  @doc("是否启用")
  active: boolean;
}

model CreateWarehouseRequest {
  @doc("仓库编码")
  code: string;

  @doc("仓库名称")
  name: string;

  @doc("仓库地址")
  address: string;
}

@doc("查询仓库列表")
@route("/warehouses")
@get
op listWarehouses(
  @header authorization: string
): ApiResponse<Warehouse[]> | Error;

@doc("创建仓库")
@route("/warehouses")
@post
op createWarehouse(
  @header authorization: string,
  @body body: CreateWarehouseRequest
): ApiResponse<Warehouse> | Error;
