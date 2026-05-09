import "@typespec/http";
import "../models.tsp";

using TypeSpec.Http;

namespace TMS;

model PageQueryStationsCondition {
  @doc("所属车间编码")
  workshopCodes?: string | string[];
  @doc("站点/区域编码")
  stationCodes?: string | string[];
}

model PageQueryStationsRequest extends HualeiRequest {
  @doc("请求接口名称")
  apiName: "hy_tms_page_query_stations_WebApi";
  @doc("请求数据")
  data: {
    ...PageRequest;
    @doc("查询条件组，条件之间为或关系，若为空数组则认为是查询全部")
    conditions?: PageQueryStationsCondition[];
  };
}

@opExample(#{
  returnType: #{
    code: 1001,
    message: "Server Error"
  }
}, #{title: "平台错误"})
@route("/orbit/modeling/webApi")
@post
op hy_tms_page_query_stations_WebApi(
  @body body: PageQueryStationsRequest
): HualeiResponse<PageResponse<Station>>;
