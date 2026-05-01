import "@typespec/http";

using TypeSpec.Http;


model BaseResponse<T> {
  @doc("业务编码")
  code: string;
  @doc("业务信息")
  message?: string;
  @doc("业务数据")
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
  YES,
  NO,
}

model Station {
  @doc("站点编码")
  code: string;
  @doc("是否锁定")
  locked: YesNo;
  @doc("是否有容器")
  hasContainer: YesNo;
  @doc("容器")
  container: string;
}
