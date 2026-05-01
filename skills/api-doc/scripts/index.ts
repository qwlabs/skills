// index.ts — CLI entry point: Adapter → Pipeline → Renderer
import { existsSync, writeFileSync, readFileSync, readdirSync } from "fs";
import { join, dirname, resolve, basename } from "path";
import { fileURLToPath } from "url";
import { typespecAdapter } from "./adapters/typespec-adapter";
import { snippetPipeline } from "./pipelines/snippet-pipeline";
import { curlPipeline } from "./pipelines/curl-pipeline";
import { htmlRenderer } from "./renderers/html";
import type { Adapter } from "./adapters/types";
import type { Pipeline } from "./pipelines/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

const adapters: Adapter[] = [typespecAdapter];
const pipelines: Pipeline[] = [snippetPipeline, curlPipeline];

function buildRevision(version: string): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}`;
  return version ? `${version}-${ts}` : ts;
}

function resolveTheme(themeName: string | undefined, themeFile: string | undefined, templateDir: string): string | undefined {
  if (themeFile) {
    if (!existsSync(themeFile)) {
      console.error("Theme file not found: " + themeFile);
      process.exit(1);
    }
    console.log("Using theme file: " + themeFile);
    return readFileSync(themeFile, "utf-8");
  }
  if (themeName) {
    const themesDir = join(dirname(templateDir), "themes");
    const presetPath = join(themesDir, `${themeName}.css`);
    if (!existsSync(presetPath)) {
      const available = readdirSync(themesDir)
        .filter((f: string) => f.endsWith(".css"))
        .map((f: string) => f.replace(/\.css$/, ""));
      console.error(`Theme "${themeName}" not found. Available: ${available.join(", ")}`);
      process.exit(1);
    }
    console.log("Using theme: " + themeName);
    return readFileSync(presetPath, "utf-8");
  }
  return undefined;
}

function detectAdapter(inputDir: string, adapterName?: string): Adapter {
  if (adapterName) {
    const adapter = adapters.find((a) => a.name === adapterName);
    if (!adapter) {
      console.error(`Adapter "${adapterName}" not found. Available: ${adapters.map((a) => a.name).join(", ")}`);
      process.exit(1);
    }
    return adapter;
  }
  for (const adapter of adapters) {
    if (adapter.detect(inputDir)) {
      return adapter;
    }
  }
  console.error("No suitable adapter found for input: " + inputDir);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);

  let adapterName: string | undefined;
  let themeName: string | undefined;
  let themeFile: string | undefined;
  const positional: string[] = [];
  let nextFlag: string | undefined;

  for (const arg of args) {
    if (nextFlag) {
      if (nextFlag === "--adapter") adapterName = arg;
      else if (nextFlag === "--theme") themeName = arg;
      else if (nextFlag === "--theme-file") themeFile = arg;
      nextFlag = undefined;
    } else if (arg === "--adapter" || arg === "--theme" || arg === "--theme-file") {
      nextFlag = arg;
    } else {
      positional.push(arg);
    }
  }

  if (positional.length < 1) {
    console.log("Usage: bun run index.ts <input-dir> [output] [--adapter <name>] [--theme <name>] [--theme-file <path>]");
    console.log("");
    console.log("  output: 可选，默认输出至 <input-dir>/../<dirName>-<revision>.html");
    console.log("Adapters: " + adapters.map((a) => a.name).join(", "));
    console.log("Themes: light (or list available with --theme-file)");
    process.exit(1);
  }

  const inputDir = positional[0];
  const inputDirName = inputDir.split("/").filter(Boolean).pop() || "output";

  if (!existsSync(inputDir)) {
    console.error("Input directory not found: " + inputDir);
    process.exit(1);
  }

  const adapter = detectAdapter(inputDir, adapterName);
  console.log(`Using adapter: ${adapter.name}`);
  console.log("Parsing: " + inputDir);

  let doc = await adapter.parse(inputDir);

  const revision = buildRevision(doc.version);

  let totalOps = 0;
  for (const group of doc.groups) {
    totalOps += group.operations.length;
    for (const op of group.operations) {
      console.log(`  [${group.name}] ${op.verb.toUpperCase()} ${op.path} — ${op.name}`);
    }
  }
  console.log(`Total: ${totalOps} operations in ${doc.groups.length} groups`);

  for (const pipeline of pipelines) {
    console.log(`Pipeline: ${pipeline.name}`);
    doc = pipeline.process(doc, { inputDir, options: {} });
  }

  const templateDir = join(__dirname, "templates");
  const themeCSS = resolveTheme(themeName, themeFile, templateDir);
  console.log("Generating HTML...");
  const output = await htmlRenderer.render(doc, { version: revision, templateDir, themeCSS });

  const outputPath = positional[1] || join(dirname(resolve(inputDir)), `${inputDirName}-${revision}.html`);
  console.log("Writing: " + outputPath);
  writeFileSync(outputPath, output, "utf-8");
  console.log("Done! Revision: " + revision);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
