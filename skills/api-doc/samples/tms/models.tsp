import "@typespec/http";

using TypeSpec.Http;


model BaseResponse<T> {
  @doc("业务编码")
  code: string;
  @doc("业务信息")
  message?: string;
  @doc("业务数据")
  @optionalIf("code=200")
  data?: T;
}

model HualeiRequest {
  @doc("接口返回格式")
  outType: "json";
}

model HualeiResponse<T> {
  @doc("状态")
  code: integer;
  @doc("错误信息")
  message?: string;
  @doc("数据")
  @optionalIf("code=200")
  data?: BaseResponse<T>;
}

model PageRequest {
  @doc("页码")
  page?: integer = 1;

  @doc("每页数量")
  pageSize?: integer = 10;
}

model PageResponse<T> {
  @doc("总数")
  total: integer;

  @doc("页码")
  page: integer;

  @doc("每页数量")
  pageSize: integer;

  @doc("数据")
  data: T[];
}

enum YesNo {
  @doc("是")
  YES,
  @doc("否")
  NO,
}


enum ExecutionStatus {
  @doc("等待")
  PENDING,
  @doc("就绪")
  READY,
  @doc("执行中")
  EXECUTING,
  @doc("已完成")
  COMPLETED,
  @doc("已失败")
  FAILED,
  @doc("已取消")
  CANCELLED,
  @doc("超时")
  TIMEOUT,
}

model Payload {
  @doc("包裹编码")
  code: string;
  @doc("包裹批次号")
  lot?: string;
  @doc("包裹分割号,建议格式示例: 2/3")
  splitCode?: string;
}

model Task {
  @doc("任务ID")
  id: string;
  @doc("装载站点编码")
  loadStationCode: string;
  @doc("卸载站点编码")
  unloadStationCode: string;
  @doc("包裹")
  payload: string;
  @doc("任务执行状态")
  executionStatus: ExecutionStatus;
}

model Station {
  @example("[A-Z][1-9]_[0-9][0-9]__[0-9][0-9][0-9]")
  @doc("站点编码")
  code: string;
  @doc("是否锁定")
  locked: YesNo;
  @doc("是否有容器")
  hasContainer: YesNo;
  @doc("容器")
  @requiredIf("hasContainer=YES")
  container?: string;
}
