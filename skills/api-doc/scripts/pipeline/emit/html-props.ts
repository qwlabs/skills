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

    // 嵌套对象/数组元素对象 → 递归展开字段行
    if (prop.type.kind === "object") {
      html += generatePropertyRows(prop.type.properties, level + 1);
    }
    if (
      prop.type.kind === "array" &&
      prop.type.elementType.kind === "object"
    ) {
      html += generatePropertyRows(prop.type.elementType.properties, level + 1);
    }
    // 联合类型 → 每个变体用分组表头行 + 独立 tbody，点击 tab 切换可见性
    if (prop.type.kind === "union") {
      html += generateUnionVariantGroups(prop.type.variants, level + 1);
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

export function generateUnionVariantGroups(variants: ApiType[], level: number): string {
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
    // 给本变体的每个字段行打标：data-union-group + union-variant（首变体 active）。
    // generatePropertyRows 产出 <tr>...</tr>，逐行注入 class/attr。
    const variantClass = i === 0 ? "union-variant active" : "union-variant";
    const groupAttr = `data-union-group="${groupId}-${i}"`;
    const rows = generatePropertyRows(v.properties!, level);
    html += tagUnionRows(rows, variantClass, groupAttr);
  });
  return html;
}

// 给 generatePropertyRows 产出的每条 <tr> 注入 class 与 data 属性。
// 行形如 `<tr>...` 或 `<tr class="x">...`，统一改写首标签。
function tagUnionRows(rowsHtml: string, cls: string, attr: string): string {
  return rowsHtml.replace(/<tr(\s[^>]*)?>/g, (m, attrs) => {
    const existing = attrs || "";
    // 合并已有 class（如 field 行无 class，扩展占位行也无）
    if (/\sclass="/.test(existing)) {
      return `<tr${existing.replace(/class="([^"]*)"/, `class="$1 ${cls}"`)} ${attr}>`;
    }
    return `<tr class="${cls}"${existing} ${attr}>`;
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
