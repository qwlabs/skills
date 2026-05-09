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
@opExample(#{
  returnType: #{
    code: 1001,
    message: "Server Error"
  }
}, #{title: "平台错误"})
#deprecated "请使用 分页查询站点信息 接口"
op hy_tms_post_transport_WebApi(
  @body body: PostTransportRequest
): HualeiResponse<Task>;
