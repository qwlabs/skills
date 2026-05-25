// pipeline/stages/sidebar-build.ts
import type { DagStage, StageContext, SidebarEntry } from "../types";
import { slugify } from "../emit/html-helpers";

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
        entries.push({ kind: "operation-link", label: op.name, anchorId: op.id, tag: op.verb.toUpperCase(), deprecated: op.deprecated });
      }
    }

    for (const msgGroup of ctx.doc.messageGroups) {
      entries.push({ kind: "group-title", label: `${msgGroup.name} (MQ)` });
      for (const msg of msgGroup.messages) {
        entries.push({ kind: "message-link", label: msg.name, anchorId: msg.id, tag: "MQ", deprecated: msg.deprecated });
      }
    }

    for (const snippet of ctx.doc.footerSnippets) {
      entries.push({ kind: "snippet-link", label: snippet.name, anchorId: `snippet-footer-${slugify(snippet.name)}` });
    }

    ctx.model.sidebar = entries;
  },
};
