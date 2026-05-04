// pipeline/runner.ts
import type { DagStage, DataKey, StageContext, StageConfig, DocumentModel, ParsedApiDoc } from "./types";

function createModel(): DocumentModel {
  return {
    meta: { title: "", version: "" },
    sidebar: [],
    sections: [],
    assets: { styles: "", scripts: "", hljsThemeCSS: "", hljsBundle: "", finalOutput: "" },
  };
}

export async function runPipeline(
  stages: DagStage[],
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

  const stageProvides = new Map<number, Set<DataKey>>();
  const stageRequires = new Map<number, Set<DataKey>>();

  for (let i = 0; i < stages.length; i++) {
    stageProvides.set(i, new Set(stages[i].provides));
    stageRequires.set(i, new Set(stages[i].requires));
  }

  const deps = new Map<number, Set<number>>();
  for (let i = 0; i < stages.length; i++) {
    const required = stageRequires.get(i)!;
    const depSet = new Set<number>();
    for (let j = 0; j < stages.length; j++) {
      if (i === j) continue;
      const provided = stageProvides.get(j)!;
      for (const r of required) {
        if (provided.has(r)) {
          depSet.add(j);
          break;
        }
      }
    }
    deps.set(i, depSet);
  }

  const inDegree = new Map<number, number>();
  for (let i = 0; i < stages.length; i++) {
    inDegree.set(i, deps.get(i)!.size);
  }

  let ready = Array.from(inDegree.entries())
    .filter(([, d]) => d === 0)
    .map(([i]) => i);

  const executed = new Set<number>();

  while (ready.length > 0) {
    const tasks = ready.map(async (i) => {
      const stage = stages[i];
      console.log(`Stage: ${stage.name}`);
      await stage.process(ctx);
      executed.add(i);
    });

    await Promise.all(tasks);

    const nextReady: number[] = [];
    for (const done of ready) {
      for (let i = 0; i < stages.length; i++) {
        if (executed.has(i)) continue;
        const depSet = deps.get(i)!;
        if (depSet.has(done)) {
          const newDeg = (inDegree.get(i) ?? 0) - 1;
          inDegree.set(i, newDeg);
          if (newDeg === 0) {
            nextReady.push(i);
          }
        }
      }
    }
    ready = nextReady;
  }

  if (executed.size !== stages.length) {
    const remaining = stages
      .map((s, i) => (executed.has(i) ? null : s.name))
      .filter(Boolean);
    throw new Error(`Pipeline cycle detected. Unexecuted stages: ${remaining.join(", ")}`);
  }

  return model;
}
