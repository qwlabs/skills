// pipeline/emit/html-props.ts
import type { ApiType, ApiParameter, ApiProperty, ApiConstraints } from "../types";
import { escapeHtml, formatType, formatEnumDoc, formatConstraints, renderBadge } from "./html-helpers";

export function generateParameterRow(param: ApiParameter): string {
  const typeDisplay = formatType(param.type);
  const requiredBadge = param.required
    ? '<span class="field-required">必填</span>'
    : '<span class="field-optional">选填</span>';
  const constraints = formatConstraints(param.constraints);
  const docHtml = escapeHtml(param.doc || "") + formatEnumDoc(param.type);

  return (
    `<tr>` +
    `<td class="field-name-cell"><code class="field-name">${escapeHtml(param.name)}</code></td>` +
    `<td><span class="field-type">${escapeHtml(typeDisplay)}</span></td>` +
    `<td>${escapeHtml(param.location)}</td>` +
    `<td>${docHtml}</td>` +
    `<td>${requiredBadge}</td>` +
    `<td>${escapeHtml(constraints)}</td>` +
    `</tr>\n`
  );
}

export function generatePropertyRows(properties: ApiProperty[], level: number): string {
  return generatePropertyRowsWithGroup(properties, level, "");
}

// 嵌套 union 的处理：外层 union 用 tagUnionRows 给变体内部所有行（含内嵌 union 的
// tabs-row / variant 行）打上 data-union-group="<外层 gid>"。内层 union 调
// generateUnionVariantGroups 再分配自己的 groupId，其 tagUnionRows 又给子行打
// data-union-group="<内层 gid>"。两轮 tagUnionRows 串接后，每行最终同时带两层
// data-union-group —— 外层控制父变体可见性，内层控制子变体可见性，互不干扰。
function generatePropertyRowsWithGroup(properties: ApiProperty[], level: number, outerGroup: string): string {
  let html = "";
  for (const prop of properties) {
    // 扩展占位行（来自 `... Record<T>` spread）：固定渲染 ... | any | (空) | ...
    if (prop.name === "...") {
      const indentClass = "field-indent-" + Math.min(level, 10);
      html +=
        `<tr>` +
        `<td class="field-name-cell ${indentClass}"><code class="field-name">...</code></td>` +
        `<td><span class="field-type">any</span></td>` +
        `<td class="constraint-cell"></td>` +
        `<td>...</td>` +
        `</tr>\n`;
      continue;
    }
    const indentClass = "field-indent-" + Math.min(level, 10);
    const typeDisplay = formatType(prop.type);

    const constraintHtml = formatConstraintsHtml(prop.required, prop.constraints, prop.defaultValue, prop.fixedValue, prop.conditionalRequired, prop.conditionalOptional);

    let versionHtml = "";
    for (const vt of prop.versionTags) {
      const label =
        vt.type === "added" ? `+${vt.version}` : `-${vt.version}`;
      versionHtml += ` ${renderBadge(label)}`;
    }

    const docHtml = escapeHtml(prop.doc || "") + formatEnumDoc(prop.type);

    html +=
      `<tr>` +
      `<td class="field-name-cell ${indentClass}"><code class="field-name">${escapeHtml(prop.name)}</code>${versionHtml}</td>` +
      `<td><span class="field-type">${escapeHtml(typeDisplay)}</span></td>` +
      `<td class="constraint-cell">${constraintHtml}</td>` +
      `<td>${docHtml}</td>` +
      `</tr>\n`;

    // 递归展开子结构：对象 / 对象数组 / 联合 / 联合数组。
    // 联合数组即「元素为多选一的数组」，此前 array<union> 被静默丢弃，
    // 导致联合类型内部再嵌套联合（如 edges: (A | B)[]）时内层不渲染。
    const childType = prop.type.kind === "array" ? prop.type.elementType : prop.type;
    if (childType.kind === "object") {
      html += generatePropertyRowsWithGroup(childType.properties, level + 1, outerGroup);
    } else if (childType.kind === "union") {
      // 联合类型 → 每个对象变体一组 tab，点击切换可见性
      html += generateUnionVariantGroups(childType.variants, level + 1, outerGroup);
    }
  }
  return html;
}

// 联合类型变体分组：每变体若干字段 <tr>，统一打 data-union-group 标识，
// 默认仅第一变体 .active 可见，其余靠 JS tab 切换。
// 用扁平 <tr>（而非嵌套 <tbody>）—— 合法 HTML，避免浏览器 tbody 重解析歧义。
// 标识用全局递增计数器，保证同页多处 union tab id 不冲突。
let unionGroupSeq = 0;

export function resetUnionGroupSeq(): void {
  unionGroupSeq = 0;
}

export function generateUnionVariantGroups(variants: ApiType[], level: number, outerGroup = ""): string {
  const objectVariants = variants.filter((v) => v.kind === "object" && v.properties);
  if (objectVariants.length < 2) return "";

  const groupId = ++unionGroupSeq;
  // pill 风格 + flex-wrap 自动换行：变体再多也只在单元格内换行，
  // min-content 宽 = 单 pill，不会撑爆表格列宽（无需 table-layout:fixed）。
  let html = `<tr class="union-tabs-row"><td colspan="4"><div class="union-tabs" data-union-tabs="${groupId}">`;
  objectVariants.forEach((v, i) => {
    // 标签：有 @doc 则「doc（类名）」，否则单类名。
    const name = escapeHtml(v.name || "object");
    const doc = v.doc ? escapeHtml(v.doc) : "";
    const label = doc ? `<span class="union-tab-doc">${doc}</span><span class="union-tab-name">${name}</span>` : name;
    const cls = i === 0 ? "union-tab active" : "union-tab";
    html += `<button type="button" class="${cls}" data-union-variant="${groupId}-${i}">${label}</button>`;
  });
  html += `</div></td></tr>\n`;

  objectVariants.forEach((v, i) => {
    // 本变体字段行打本层 data-union-group="<gid>-<i>"，首变体 active。
    // 嵌套时外层 tagUnionRows 把外层 group 并入 data-union-group，并按「内外 active 取 AND」
    // 修正可见性——故此处只需表达「本层首变体可见、其余隐藏」。
    const variantClass = i === 0 ? "union-variant active" : "union-variant";
    const rows = generatePropertyRowsWithGroup(v.properties!, level, `${groupId}-${i}`);
    html += tagUnionRows(rows, variantClass, `${groupId}-${i}`, outerGroup);
  });
  return html;
}

// 给 generatePropertyRows 产出的每条 <tr> 注入 class 与 data 属性。
// 行形如 `<tr>...` 或 `<tr class="x">...`，统一改写首标签。
// 嵌套 union 时内层行已带自己的 class + data-union-group；外层 tagUnionRows 分两类处理：
//   - 有内层 data-union-group（内层变体行或其字段）：可见性按 AND（内外层都 active 才 active），
//     data-union-group 合并（内层 ∪ 外层）。
//   - 无内层 data-union-group（结构行 union-tabs-row，或不在任何内层 union 的普通字段）：
//     直接采用外层可见性，data-union-group 只挂外层 group。
// selfGroup：本层变体标识；outerGroup：所有祖先变体标识（可多个，空格分隔）。
function tagUnionRows(rowsHtml: string, cls: string, selfGroup: string, outerGroup: string): string {
  const groups = outerGroup ? `${selfGroup} ${outerGroup}` : selfGroup;
  const outerActive = cls.includes("active");
  return rowsHtml.replace(/<tr(\s[^>]*)?>/g, (_m, attrs) => {
    const existing = attrs || "";
    const hasInnerGroup = / data-union-group="/.test(existing);
    let outTag: string;

    if (hasInnerGroup) {
      // 内层变体行 / 其字段：可见性 AND，group 合并
      outTag = `<tr${existing.replace(/class="([^"]*)"/, (_full, prev: string) => {
        const set = new Set(prev.trim().split(/\s+/));
        const innerActive = set.has("active");
        set.delete("active");
        cls.split(/\s+/).forEach((c) => { if (c && c !== "active") set.add(c); });
        if (outerActive && innerActive) set.add("active");
        return `class="${Array.from(set).join(" ")}"`;
      })}>`;
      outTag = outTag.replace(/ data-union-group="([^"]*)"/, (_full, prev: string) => {
        const set = new Set(groups.split(/\s+/));
        prev.split(/\s+/).forEach((g) => set.add(g));
        return ` data-union-group="${Array.from(set).join(" ")}"`;
      });
    } else {
      // 结构行（tab 条）或普通字段：直接采用外层可见性，只挂外层 group
      if (/\sclass="/.test(existing)) {
        outTag = `<tr${existing.replace(/class="([^"]*)"/, (_full, prev: string) => {
          const set = new Set(prev.trim().split(/\s+/));
          cls.split(/\s+/).forEach((c) => c && set.add(c));
          return `class="${Array.from(set).join(" ")}"`;
        })}>`;
      } else {
        outTag = `<tr class="${cls}"${existing}>`;
      }
      outTag = outTag.replace(/>\s*$/, ` data-union-group="${groups}">`);
    }
    return outTag;
  });
}

function formatConstraintsHtml(required: boolean, c: ApiConstraints, defaultValue?: unknown, fixedValue?: unknown, conditionalRequired?: string, conditionalOptional?: string): string {
  const lines: string[] = [];

  if (fixedValue !== undefined) {
    lines.push(`<span class="constraint-tag constraint-fixed">固定值</span> <code>${escapeHtml(String(fixedValue))}</code>`);
  } else if (conditionalRequired) {
    lines.push(`<span class="constraint-tag constraint-conditional">条件必填</span> ${escapeHtml(conditionalRequired)}`);
  } else if (conditionalOptional) {
    lines.push(`<span class="constraint-tag constraint-optional-conditional">条件选填</span> ${escapeHtml(conditionalOptional)}`);
  } else if (required) {
    lines.push('<span class="constraint-tag constraint-required">必填</span>');
  } else {
    const defaultPart = defaultValue !== undefined ? ` <span class="constraint-item">默认 <code>${escapeHtml(String(defaultValue))}</code></span>` : "";
    lines.push(`<span class="constraint-tag constraint-optional">选填</span>${defaultPart}`);
  }

  if (c.minimum !== undefined || c.maximum !== undefined) {
    const min = c.minimum !== undefined ? String(c.minimum) : "";
    const max = c.maximum !== undefined ? String(c.maximum) : "";
    const expr = min && max ? `[${min}, ${max}]` : min ? `≥ ${min}` : `≤ ${max}`;
    lines.push(`<span class="constraint-item">值域 ${expr}</span>`);
  }
  if (c.minLength !== undefined || c.maxLength !== undefined) {
    const min = c.minLength !== undefined ? String(c.minLength) : "";
    const max = c.maxLength !== undefined ? String(c.maxLength) : "";
    const expr = min && max ? `[${min}, ${max}]` : min ? `≥ ${min}` : `≤ ${max}`;
    lines.push(`<span class="constraint-item">长度 ${expr}</span>`);
  }

  if (c.pattern !== undefined) {
    lines.push(`<span class="constraint-item">格式 /${c.pattern}/</span>`);
  }

  return lines.join("<br>");
}
