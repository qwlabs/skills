import "@typespec/http";
import "./models.tsp";
import "./转运.tsp";
import "./转运/装载包裹并转运.tsp";
import "./查询/分页查询站点信息.tsp";

using TypeSpec.Http;

@service(#{title: "TMS API"})
namespace TMS;
