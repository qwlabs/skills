import { existsSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import { parseTypeSpecDir } from "./typespec-parser.js";
import { generateHtml } from "./html-generator.js";
import type { MarkdownSnippet } from "./types.js";

function getVersion(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `v1.0.0-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("Usage: bun run converter.ts <input-dir> <output.html>");
    console.log("  <input-dir>: directory containing .tsp files");
    console.log("");
    console.log("Input structure:");
    console.log("  main.tsp            — shared models and service definition");
    console.log("  <group>/<file>.tsp  — grouped API operations");
    process.exit(1);
  }

  const inputDir = args[0];
  const outputPath = args[1];

  if (!existsSync(inputDir)) {
    console.error("Input directory not found: " + inputDir);
    process.exit(1);
  }

  console.log("Parsing TypeSpec: " + inputDir);
  const doc = await parseTypeSpecDir(inputDir);

  // Load header/footer markdown snippets
  doc.headerSnippets = loadSnippets(inputDir, "header");
  doc.footerSnippets = loadSnippets(inputDir, "footer");

  let totalOps = 0;
  for (const group of doc.groups) {
    totalOps += group.operations.length;
    for (const op of group.operations) {
      console.log(
        `  [${group.name}] ${op.verb.toUpperCase()} ${op.path} — ${op.name}`
      );
    }
  }
  console.log(
    `Total: ${totalOps} operations in ${doc.groups.length} groups`
  );

  console.log("Generating HTML...");
  const version = getVersion();
  const html = await generateHtml(doc, version);

  console.log("Writing: " + outputPath);
  writeFileSync(outputPath, html, "utf-8");
  console.log("Done! Version: " + version);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Load markdown snippets from the input directory.
 *
 * Supported formats:
 *   header_1_A.md    → position=header, index=1, name=A
 *   header_2_B.md    → position=header, index=2, name=B
 *   header_A.md      → position=header, index=natural, name=A
 *   footer_1_Changelog.md → position=footer, index=1, name=Changelog
 */
function loadSnippets(inputDir: string, position: "header" | "footer"): MarkdownSnippet[] {
  const entries = readdirSync(inputDir);
  const prefix = position + "_";

  const snippets: { index: number; name: string; content: string }[] = [];

  for (const entry of entries) {
    if (!entry.startsWith(prefix) || !entry.endsWith(".md")) continue;

    const body = entry.slice(prefix.length, -3); // strip prefix and .md

    // Try format: index_name (e.g. "1_A")
    const indexedMatch = body.match(/^(\d+)_(.+)$/);
    if (indexedMatch) {
      snippets.push({
        index: parseInt(indexedMatch[1], 10),
        name: indexedMatch[2],
        content: readFileSync(join(inputDir, entry), "utf-8"),
      });
    } else {
      // Format: name only (e.g. "A")
      snippets.push({
        index: snippets.length, // natural order
        name: body,
        content: readFileSync(join(inputDir, entry), "utf-8"),
      });
    }
  }

  snippets.sort((a, b) => a.index - b.index);

  return snippets.map(({ name, content }) => ({ name, content }));
}
