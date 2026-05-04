// pipeline/stages/asset-load.ts
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { DagStage, StageContext } from "../types";

export const assetLoad: DagStage = {
  name: "asset-load",
  requires: [],
  provides: ["model.assets"],
  process(ctx: StageContext): void {
    const dir = ctx.config.templateDir;

    const stylesPath = join(dir, "styles.css");
    ctx.model.assets.styles = existsSync(stylesPath) ? readFileSync(stylesPath, "utf-8") : "";

    if (ctx.config.themeCSS) {
      ctx.model.assets.styles += "\n" + ctx.config.themeCSS;
    }

    const scriptsPath = join(dir, "scripts.js");
    ctx.model.assets.scripts = existsSync(scriptsPath) ? readFileSync(scriptsPath, "utf-8") : "";

    ctx.model.assets.hljsThemeCSS = inlineFile(dir, "vendor", "atom-one-dark.min.css");
    ctx.model.assets.hljsBundle = [
      inlineFile(dir, "vendor", "highlight.min.js"),
      inlineFile(dir, "vendor", "json.min.js"),
      inlineFile(dir, "vendor", "bash.min.js"),
    ].join("\n");
  },
};

function inlineFile(templateDir: string, ...segments: string[]): string {
  const p = join(templateDir, ...segments);
  if (existsSync(p)) return readFileSync(p, "utf-8");
  console.warn("Warning: vendor file not found: " + p);
  return "";
}
