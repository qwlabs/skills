namespace WMS.出库;

using TypeSpec.Http;

model OutboundItem {
  @doc("商品编码")
  sku: string;

  @doc("数量")
  @minValue(1)
  quantity: int32;
}

model OutboundOrder {
  @doc("出库单号")
  id: string;

  @doc("客户名称")
  customerName: string;

  @doc("仓库编码")
  warehouseCode: string;

  @doc("商品列表")
  items: OutboundItem[];

  @doc("创建时间")
  createdAt: utcDateTime;
}

model CreateOutboundOrderRequest {
  @doc("客户名称")
  customerName: string;

  @doc("出库仓库编码")
  warehouseCode: string;

  @doc("商品列表")
  items: OutboundItem[];
}

@doc("创建出库单")
@route("/outbound/orders")
@post
op createOutboundOrder(
  @header authorization: string,
  @body body: CreateOutboundOrderRequest
): ApiResponse<OutboundOrder> | Error;

@doc("查询出库单列表")
@route("/outbound/orders")
@get
op listOutboundOrders(
  @header authorization: string,
  @query page?: int32,
  @query pageSize?: int32
): ApiResponse<PageResponse<OutboundOrder>> | Error;
