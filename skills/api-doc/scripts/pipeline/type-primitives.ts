// pipeline/type-primitives.ts
// 从 typespec-parse 抽出的纯原语：零编译器依赖，可独立单测。
//
// 这些函数原本埋在 typespec-parse.ts（711 行）里，与 compile() I/O 纠缠，
// 没有独立的缝可测。它们唯一的依赖是 ApiType 值对象（../types）或纯字符串/unknown，
// 抽到此处后获得自己的接口 —— 接口即测试面。

import type { ApiType } from "./types";

// --- Scalar 基础类型映射 ---

const INTEGER_TYPES = new Set(["int32", "int64", "integer", "safeint", "int128", "uint8", "uint16", "uint32", "uint64"]);
const FLOAT_TYPES = new Set(["float", "double", "decimal", "decimal128", "numeric"]);
const DATETIME_TYPES = new Set(["utcdatetime", "offsetdatetime", "datetime"]);

// TypeSpec scalar 名 → ApiType 基础类型。大小写不敏感。
export function resolveScalarBase(scalarName: string): ApiType {
  const name = scalarName.toLowerCase();
  if (INTEGER_TYPES.has(name)) return { kind: "integer" };
  if (FLOAT_TYPES.has(name)) return { kind: "float" };
  if (name === "boolean") return { kind: "boolean" };
  if (name === "string") return { kind: "string" };
  if (DATETIME_TYPES.has(name)) return { kind: "datetime" };
  if (name === "uuid" || name === "guid") return { kind: "uuid" };
  return { kind: "any" };
}

// --- @opExample / @example 值的深拷贝 ---
//
// TypeSpec 装饰器参数里的 EnumMember/EnumValue/ScalarValue 等编译期对象，
// 需要规约为可 JSON 序列化的字面量才能写进文档示例。

export function deepCloneValue(val: unknown, seen: Set<unknown> = new Set()): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") return val;
  if (typeof val !== "object") return String(val);
  if (seen.has(val)) return undefined;
  seen.add(val);
  const obj = val as Record<string, unknown>;
  if (obj.kind === "EnumMember" && typeof obj.name === "string") return obj.name;
  if (obj.valueKind === "EnumValue" && obj.value && typeof (obj.value as any).name === "string") {
    return (obj.value as any).name;
  }
  // ScalarValue（如 utcDateTime.fromISO("...")）：序列化为构造器的字面量值。
  // 形如 { valueKind: "ScalarValue", value: { name: "fromISO", args: [{ valueKind: "StringValue", value: "2026-..." }] } }
  if (obj.valueKind === "ScalarValue" && obj.value) {
    const scalar = obj.value as any;
    const args = (scalar.args ?? []) as any[];
    for (const arg of args) {
      if (arg.valueKind === "StringValue" && typeof arg.value === "string") {
        return arg.value;
      }
    }
  }
  if (Array.isArray(val)) {
    return val.map((item) => deepCloneValue(item, seen));
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = deepCloneValue(v, seen);
  }
  return result;
}

// --- HTTP 状态码判定 ---

export function isErrorResponse(statusCode: string): boolean {
  const code = parseInt(statusCode, 10);
  return !isNaN(code) && code >= 400;
}
