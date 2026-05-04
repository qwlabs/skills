// pipeline/stages/section-build.ts
import type { DagStage, StageContext, ContentSection } from "../types";
import { slugify } from "../emit/html-helpers";

export const sectionBuild: DagStage = {
  name: "section-build",
  requires: ["doc.api", "doc.snippets", "doc.curl"],
  provides: ["model.sections"],
  process(ctx: StageContext): void {
    const sections: ContentSection[] = [];

    for (const snippet of ctx.doc.headerSnippets) {
      sections.push({ kind: "snippet", anchorId: `snippet-header-${slugify(snippet.name)}`, title: snippet.name, content: snippet.content });
    }

    for (const group of ctx.doc.groups) {
      for (const op of group.operations) {
        sections.push({ kind: "operation", op });
      }
    }

    for (const snippet of ctx.doc.footerSnippets) {
      sections.push({ kind: "snippet", anchorId: `snippet-footer-${slugify(snippet.name)}`, title: snippet.name, content: snippet.content });
    }

    sections.push({ kind: "footer", version: "{{version}}" });

    ctx.model.sections = sections;
  },
};
