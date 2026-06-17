import "@typespec/http";
import "../models.tsp";

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


@doc("用户可以在列表页面点击「装载」按钮，对单个站点发起装载请求。系统会自动锁定站点，防止并发操作。如果站点已有容器，会返回错误。")
@route("/orbit/modeling/webApi")
@post
@opExample(#{
  parameters: #{
    body: #{
      outType: "json",
      apiName: "hy_tms_station_lay_container_WebApi",
      data: #{ stationCodes: #["A1_10__001"] }
    }
  },
  returnType: #{
    code: 200,
    message: "success",
    data: #{
      code: "200",
      message: "操作成功",
      data: #{
        code: "A1_10__001",
        locked: YesNo.YES,
        hasContainer: YesNo.YES,
        container: "CT-20260430-001"
      }
    }
  }
}, #{
  title: "操作成功"
})
@opExample(#{
  parameters: #{
    body: #{
      outType: "json",
      apiName: "hy_tms_station_lay_container_WebApi",
      data: #{ stationCodes: #["A1_10__001", "A1_10__002", "A1_10__003"] }
    }
  },
  returnType: #{
    code: 200,
    message: "success",
    data: #{
      code: "400",
      message: "站点已经被锁定"
    }
  }
}, #{
  title: "操作失败"
})
@opExample(#{
  returnType: #{
    code: 1001,
    message: "Server Error"
  }
}, #{title: "平台错误"})
op hy_tms_station_lay_container_WebApi(
  @body body: StationLayContainerRequest
): HualeiResponse<Station>;

