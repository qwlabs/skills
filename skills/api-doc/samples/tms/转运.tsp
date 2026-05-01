import "@typespec/http";
import "./models.tsp";

using TypeSpec.Http;

namespace TMS;

model StationLayContainerRequest extends HualeiRequest {
    @doc("请求接口名称")
    apiName: "hy_tms_station_lay_container_WebApi";
    @doc("请求数据")
    data: {
      @doc("放置站点")
      @minItems(1)
      stationCodes: string[];
    };
}

@doc("站点放置容器")
@route("/orbit/modeling/webApi")
@post
@opExample(#{
  parameters: #{
    body: #{
      outType: "json",
      apiName: "hy_tms_station_lay_container_WebApi",
      data: #{ stationCodes: #["ST-001"] }
    }
  },
  returnType: #{
    code: 200,
    message: "success",
    data: #{
      code: "0",
      message: "操作成功",
      data: #{
        code: "ST-001",
        locked: YesNo.YES,
        hasContainer: YesNo.YES,
        container: "CT-20260430-001"
      }
    }
  }
}, #{
  title: "成功响应"
})
@opExample(#{
  parameters: #{
    body: #{
      outType: "json",
      apiName: "hy_tms_station_lay_container_WebApi",
      data: #{ stationCodes: #["ST-001", "ST-002", "ST-003"] }
    }
  },
  returnType: #{
    code: 200,
    message: "success",
    data: #{
      code: "0",
      message: "操作成功",
      data: #{
        code: "ST-003",
        locked: YesNo.YES,
        hasContainer: YesNo.NO,
        container: ""
      }
    }
  }
}, #{
  title: "批量查询"
})
@opExample(#{
  returnType: #{
    code: 1001,
    message: "Server Error"
  }
}, #{title: "平台错误"})
op station_lay_container(
  @body body: StationLayContainerRequest
): HualeiResponse<Station>;

