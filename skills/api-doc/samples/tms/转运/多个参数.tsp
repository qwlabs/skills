import "@typespec/http";
import "../models.tsp";

using TypeSpec.Http;
namespace TMS;



@doc("加工记录")
model MachiningRecordPayload {
  @doc("加工任务编码")
  code: string;
  @doc("工艺规程编码")
  processPlanCode: string;
  @doc("工艺规程版本")
  processPlanVersion: string;
  @doc("工序号")
  operationNo: string;
}

@doc("材料投产风险放行单")
model MaterialRRRecordPayload {
  @doc("单据编码")
  code: string;
  @doc("生产订单编号")
  productOrderCode: string;
  ... Record<unknown>;
}


model PutHistoryRecord {
  @doc("发生时间")
  eventAt?: utcDateTime;
  @doc("类别(请参考 履历记录类别清单)")
  category: string;
  @doc("履历数据载体")
  payload: MachiningRecordPayload | MaterialRRRecordPayload;
}


model DuoRequest extends HualeiRequest {
    @doc("请求接口名称")
    apiName: "hy_tms_duo_WebApi";
    @doc("请求数据")
    data: {
      @doc("履历记录")
      records: PutHistoryRecord[];
    };
}

@route("/orbit/modeling/webApi")
@post
@opExample(#{
  returnType: #{
    code: 1001,
    message: "Server Error"
  }
}, #{title: "平台错误"})
op hy_tms_duo_WebApi(
  @body body: DuoRequest
): HualeiResponse<void>;
