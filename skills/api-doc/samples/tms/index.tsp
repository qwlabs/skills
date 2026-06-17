import "@typespec/http";
import "./models.tsp";
import "./转运/放置空容器.tsp";
import "./转运/装载包裹并转运.tsp";
import "./查询/分页查询站点信息.tsp";
import "./转运/任务状态变更消息.tsp";
import "./转运/转运任务创建消息.tsp";

using TypeSpec.Http;

@service(#{title: "TMS API"})
namespace TMS;
