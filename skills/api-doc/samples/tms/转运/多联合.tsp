import "@typespec/http";
import "../models.tsp";
using TypeSpec.Http;
namespace TMS;

@doc("加工记录")
model Q_Machining { @doc("加工任务编码") code: string; }
@doc("材料投产风险放行单")
model Q_MaterialRR { @doc("单据编码") code: string; }
@doc("质检记录")
model Q_Quality { @doc("质检单号") code: string; }
model Q_Logistics { @doc("运单号") code: string; }
@doc("仓储记录")
model Q_Warehouse { @doc("入库单号") code: string; }
@doc("设备记录")
model Q_Equipment { @doc("设备编码") code: string; }
@doc("能耗记录")
model Q_Energy { @doc("能耗读数") code: string; }
@doc("维修记录")
model Q_Maintenance { @doc("维修单号") code: string; }

model ManyUnionBody {
  @doc("履历数据载体")
  payload: Q_Machining | Q_MaterialRR | Q_Quality | Q_Logistics | Q_Warehouse | Q_Equipment | Q_Energy | Q_Maintenance;
}

@route("/orbit/modeling/webApi")
@post
op many_union_WebApi(@body body: ManyUnionBody): HualeiResponse<void>;
