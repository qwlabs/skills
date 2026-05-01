import "@typespec/http";
import "./models.tsp";
import "./转运.tsp";

using TypeSpec.Http;

@service(#{title: "TMS API"})
namespace TMS;
