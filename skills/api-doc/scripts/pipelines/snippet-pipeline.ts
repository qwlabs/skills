// pipelines/snippet-pipeline.ts
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { ParsedApiDoc, MarkdownSnippet } from "../adapters/types";
import type { Pipeline, PipelineContext } from "./types";

export const snippetPipeline: Pipeline = {
  name: "snippet",
  process(doc: ParsedApiDoc, ctx: PipelineContext): ParsedApiDoc {
    doc.headerSnippets = loadSnippets(ctx.inputDir, "header");
    doc.footerSnippets = loadSnippets(ctx.inputDir, "footer");
    return doc;
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
