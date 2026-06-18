// pipeline/revision.ts
// 版本号 → 文档 revision 字符串。
//
// 单一来源：parse stage 读基础版本（api-doc.json > @service.version），
// 入口传入 now，这里拼成 `${version}-YYYYMMDDHH`；无基础版本时仅时间戳。

export function buildRevision(version: string, now: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}`;
  return version ? `${version}-${ts}` : ts;
}
