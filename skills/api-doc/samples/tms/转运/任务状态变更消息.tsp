import "@typespec/http";
import "../models.tsp";

using TypeSpec.Http;

namespace TMS;

@doc("当任务状态发生变更时候回发出此消息")
@topic("tms.task.events")
@example(#{
  taskId: "TASK-001",
  status: ExecutionStatus.COMPLETED,
  changedAt: utcDateTime.fromISO("2026-06-17T10:00:00Z"),
  reason: "已送达",
  s1: "test",
  f1: 3.3
}, #{
  title: "完成"
})
model TaskStatusChangeMessage {
  @doc("任务ID")
  taskId: string;
  @doc("新状态")
  status: ExecutionStatus;
  @doc("变更时间")
  changedAt: utcDateTime;
  @doc("变更原因")
  @optionalIf("status=COMPLETED")
  reason?: string;
  ... Record<Any>;
}
