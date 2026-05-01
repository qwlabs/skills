import "@typespec/http";
import "../models.tsp";

using TypeSpec.Http;

namespace TMS;

model PostTransportRequest extends HualeiRequest {
    @doc("请求接口名称")
    apiName: "hy_tms_post_transport_WebApi";
    @doc("请求数据")
    data: {
      @doc("任务ID")
      taskId?: string;
      @doc("包裹")
      payload: Payload;
      @doc("装载站点编码")
      loadStationCode: string;
      @doc("卸载站点编码")
      @minItems(1)
      unloadStationCodes: string[];
    };
}

@route("/orbit/modeling/webApi")
@post
op post_transport(
  @body body: PostTransportRequest
): HualeiResponse<Task>;
