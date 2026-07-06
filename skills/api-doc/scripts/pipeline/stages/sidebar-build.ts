import type { DagStage, StageContext, SidebarEntry } from "../types";
import { slugify } from "../emit/html-helpers";

// 侧边栏默认宽度估算系数 —— 仅作首帧 placeholder，运行时 JS 用 offsetWidth 精确覆盖。
// ponytail: 粗估即可，中英文混排的真实像素交给运行时测量。
export const SIDEBAR_W_MIN = 200;
export const SIDEBAR_W_MAX = 380;
const CJK_PX = 15;       // 单个 CJK 字符估算宽度
const ASCII_PX = 8;      // 单个 ASCII 字符估算宽度
const PADDING_PX = 30;   // toc-link 左右内边距合计
const TAG_PX = 40;       // HTTP/MQ 标签徽章 + 废弃徽章余量（仅 doc-link）

/** 单个 label 的估算像素宽度。hasTag 为 true 时计入标签徽章余量。 */
function estimateLabelWidth(label: string, hasTag: boolean): number {
  let w = PADDING_PX;
  if (hasTag) w += TAG_PX;
  for (const ch of label) {
    w += isCjk(ch) ? CJK_PX : ASCII_PX;
  }
  return w;
}

function isCjk(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x4e00 && c <= 0x9fff)   // CJK 统一表意文字
      || (c >= 0x3000 && c <= 0x30ff)   // CJK 符号/假名
      || (c >= 0xff00 && c <= 0xffef);  // 全角形式
}

/** 按最长菜单项不折行估算侧边栏默认宽度，封顶 SIDEBAR_W_MAX、保底 SIDEBAR_W_MIN。 */
export function estimateSidebarWidth(entries: SidebarEntry[]): number {
  let max = 0;
  for (const entry of entries) {
    const w = estimateLabelWidth(entry.label, entry.kind === "doc-link");
    if (w > max) max = w;
  }
  return Math.max(SIDEBAR_W_MIN, Math.min(max, SIDEBAR_W_MAX));
}

export const sidebarBuild: DagStage = {
  name: "sidebar-build",
  requires: ["doc.api", "doc.snippets"],
  provides: ["model.sidebar"],
  process(ctx: StageContext): void {
    const entries: SidebarEntry[] = [];

    for (const snippet of ctx.doc.headerSnippets) {
      entries.push({ kind: "snippet-link", label: snippet.name, anchorId: `snippet-header-${slugify(snippet.name)}` });
    }

    for (const group of ctx.doc.groups) {
      entries.push({ kind: "group-title", label: group.name });
      for (const op of group.operations) {
        entries.push({ kind: "doc-link", label: op.name, anchorId: op.id, protocol: "http", deprecated: op.deprecated });
      }
      for (const msg of group.messages) {
        entries.push({ kind: "doc-link", label: msg.name, anchorId: msg.id, protocol: "mq", deprecated: msg.deprecated });
      }
    }

    for (const snippet of ctx.doc.footerSnippets) {
      entries.push({ kind: "snippet-link", label: snippet.name, anchorId: `snippet-footer-${slugify(snippet.name)}` });
    }

    ctx.model.sidebar = entries;
    // 记录估算的默认宽度，供 html-emit 注入 :root{--sidebar-w}（首帧 placeholder）。
    ctx.model.sidebarWidth = estimateSidebarWidth(entries);
  },
};