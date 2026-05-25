import "@typespec/http";
import "../models.tsp";

using TypeSpec.Http;

namespace TMS;

@doc("转运任务创建消息")
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
  createdAt: datetime;
}

@doc("任务状态变更消息")
@topic("tms.task.events")
model TaskStatusChangeMessage {
  @doc("任务ID")
  taskId: string;
  @doc("新状态")
  status: ExecutionStatus;
  @doc("变更时间")
  changedAt: datetime;
  @doc("变更原因")
  @optionalIf("status=COMPLETED")
  reason?: string;
}
