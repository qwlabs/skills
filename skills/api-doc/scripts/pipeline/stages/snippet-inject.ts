// pipeline/stages/snippet-inject.ts
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { MarkdownSnippet, Stage, StageContext } from "../types";

export const snippetInject: Stage = {
  name: "snippet-inject",
  process(ctx: StageContext): void {
    ctx.doc.headerSnippets = loadSnippets(ctx.config.inputDir, "header");
    ctx.doc.footerSnippets = loadSnippets(ctx.config.inputDir, "footer");
  },
};

function loadSnippets(inputDir: string, position: "header" | "footer"): MarkdownSnippet[] {
  const entries = readdirSync(inputDir);
  const prefix = position + "_";
  const snippets: { index: number; name: string; content: string }[] = [];

  for (const entry of entries) {
    if (!entry.startsWith(prefix) || !entry.endsWith(".md")) continue;
    const body = entry.slice(prefix.length, -3);
    const indexedMatch = body.match(/^(\d+)_(.+)$/);
    if (indexedMatch) {
      snippets.push({
        index: parseInt(indexedMatch[1], 10),
        name: indexedMatch[2],
        content: readFileSync(join(inputDir, entry), "utf-8"),
      });
    } else {
      snippets.push({
        index: snippets.length,
        name: body,
        content: readFileSync(join(inputDir, entry), "utf-8"),
      });
    }
  }

  snippets.sort((a, b) => a.index - b.index);
  return snippets.map(({ name, content }) => ({ name, content }));
}
