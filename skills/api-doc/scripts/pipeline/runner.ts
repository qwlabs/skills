// pipeline/runner.ts
import type { Stage, StageContext, StageConfig, DocumentModel, ParsedApiDoc } from "./types";

function createModel(): DocumentModel {
  return {
    meta: { title: "", version: "" },
    sidebar: [],
    sections: [],
    assets: { styles: "", scripts: "", hljsThemeCSS: "", hljsBundle: "", finalOutput: "" },
  };
}

export async function runPipeline(
  stages: Stage[],
  config: StageConfig
): Promise<DocumentModel> {
  const doc: ParsedApiDoc = {
    title: "",
    version: "",
    headerSnippets: [],
    footerSnippets: [],
    groups: [],
  };
  const model = createModel();
  const ctx: StageContext = { doc, model, config };
  for (const stage of stages) {
    console.log(`Stage: ${stage.name}`);
    await stage.process(ctx);
  }
  return model;
}
