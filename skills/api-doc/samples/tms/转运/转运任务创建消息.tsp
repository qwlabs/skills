import "@typespec/http";
import "../models.tsp";

using TypeSpec.Http;

namespace TMS;

@doc("当转运任务创建消息时候会发出此消息")
@topic("tms.task.events")
model TaskCreateMessage {
  @doc("任务ID")
  taskId: string;
  @doc("装载站点编码")
  loadStationCode: string;
  @doc("卸载站点编码")
  unloadStationCode: string;
  @doc("包裹编码")
  payloadCode: string;
  @doc("创建时间")
  createdAt: utcDateTime;
}
