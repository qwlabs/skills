// index.ts — CLI entry point: Stage Pipeline → Output
import { existsSync, writeFileSync, readFileSync, readdirSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { runPipeline } from "./pipeline/runner";
import { typespecParse } from "./pipeline/stages/typespec-parse";
import { snippetInject } from "./pipeline/stages/snippet-inject";
import { curlGenerate } from "./pipeline/stages/curl-generate";
import { sidebarBuild } from "./pipeline/stages/sidebar-build";
import { sectionBuild } from "./pipeline/stages/section-build";
import { assetLoad } from "./pipeline/stages/asset-load";
import { htmlEmit } from "./pipeline/emit/html-emit";
import type { DagStage } from "./pipeline/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

const stages: DagStage[] = [typespecParse, snippetInject, curlGenerate, sidebarBuild, sectionBuild, assetLoad, htmlEmit];

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

async function main() {
  const args = process.argv.slice(2);

  let themeName: string | undefined;
  let themeFile: string | undefined;
  const positional: string[] = [];
  let nextFlag: string | undefined;

  for (const arg of args) {
    if (nextFlag) {
      if (nextFlag === "--theme") themeName = arg;
      else if (nextFlag === "--theme-file") themeFile = arg;
      nextFlag = undefined;
    } else if (arg === "--theme" || arg === "--theme-file") {
      nextFlag = arg;
    } else {
      positional.push(arg);
    }
  }

  if (positional.length < 1) {
    console.log("Usage: bun run index.ts <input-dir> [output] [--theme <name>] [--theme-file <path>]");
    console.log("");
    console.log("  output: 可选，默认输出至 <input-dir>/../<dirName>-<revision>.html");
    console.log("Themes: light (or list available with --theme-file)");
    process.exit(1);
  }

  const inputDir = positional[0];
  const inputDirName = inputDir.split("/").filter(Boolean).pop() || "output";

  if (!existsSync(inputDir)) {
    console.error("Input directory not found: " + inputDir);
    process.exit(1);
  }

  console.log("Parsing: " + inputDir);

  const templateDir = join(__dirname, "templates");
  const themeCSS = resolveTheme(themeName, themeFile, templateDir);

  const model = await runPipeline(stages, { inputDir, templateDir, themeCSS, version: "" });

  const revision = buildRevision(model.meta.version);

  // 打印操作列表
  let totalOps = 0;
  for (const section of model.sections) {
    if (section.kind === "operation") {
      totalOps++;
      const op = section.op;
      console.log(`  [${op.group}] ${op.verb.toUpperCase()} ${op.path} — ${op.name}`);
    }
  }
  const groupNames = new Set(model.sidebar.filter(e => e.kind === "group-title").map(e => e.label));
  console.log(`Total: ${totalOps} operations in ${groupNames.size} groups`);

  const outputPath = positional[1] || join(dirname(resolve(inputDir)), `${inputDirName}-${revision}.html`);
  console.log("Writing: " + outputPath);

  // 替换模板中的版本号（pipeline 用空 version 运行，这里替换为含时间戳的 revision）
  const output = model.assets.finalOutput.replace(/\{\{version\}\}/g, revision);
  writeFileSync(outputPath, output, "utf-8");
  console.log("Done! Revision: " + revision);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
