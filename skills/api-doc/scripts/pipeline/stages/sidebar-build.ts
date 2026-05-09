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
        entries.push({ kind: "operation-link", label: op.name, anchorId: op.id, deprecated: op.deprecated });
      }
    }

    for (const snippet of ctx.doc.footerSnippets) {
      entries.push({ kind: "snippet-link", label: snippet.name, anchorId: `snippet-footer-${slugify(snippet.name)}` });
    }

    ctx.model.sidebar = entries;
  },
};
