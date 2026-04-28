namespace WMS.入库;

using TypeSpec.Http;

model InboundItem {
  @doc("商品编码")
  sku: string;

  @doc("数量")
  @minValue(1)
  quantity: int32;
}

model InboundOrder {
  @doc("入库单号")
  id: string;

  @doc("供应商名称")
  supplierName: string;

  @doc("仓库编码")
  warehouseCode: string;

  @doc("商品列表")
  items: InboundItem[];

  @doc("创建时间")
  createdAt: utcDateTime;

  @doc("状态")
  status: string;
}

model CreateInboundOrderRequest {
  @doc("供应商名称")
  supplierName: string;

  @doc("入库仓库编码")
  warehouseCode: string;

  @doc("商品列表")
  items: InboundItem[];
}

@doc("创建入库单")
@route("/inbound/orders")
@post
op createInboundOrder(
  @header authorization: string,
  @body body: CreateInboundOrderRequest
): ApiResponse<InboundOrder> | Error;

@doc("查询入库单列表")
@route("/inbound/orders")
@get
op listInboundOrders(
  @header authorization: string,
  @query page?: int32,
  @query pageSize?: int32
): ApiResponse<PageResponse<InboundOrder>> | Error;
