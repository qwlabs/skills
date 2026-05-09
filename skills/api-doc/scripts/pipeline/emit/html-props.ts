// pipeline/emit/html-props.ts
import { render } from "./loader";
import type { ApiParameter, ApiProperty, ApiConstraints } from "../types";
import { escapeHtml, formatType, formatEnumDoc, formatConstraints } from "./html-helpers";

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
    const indentClass = "field-indent-" + Math.min(level, 10);
    const typeDisplay = formatType(prop.type);

    const constraintHtml = formatConstraintsHtml(prop.required, prop.constraints, prop.defaultValue, prop.fixedValue, prop.conditionalRequired, prop.conditionalOptional);

    let versionHtml = "";
    for (const vt of prop.versionTags) {
      const label =
        vt.type === "added" ? `+${vt.version}` : `-${vt.version}`;
      versionHtml += ` ${render("badge", label)}`;
    }

    const docHtml = escapeHtml(prop.doc || "") + formatEnumDoc(prop.type);

    html +=
      `<tr>` +
      `<td class="field-name-cell ${indentClass}"><code class="field-name">${escapeHtml(prop.name)}</code>${versionHtml}</td>` +
      `<td><span class="field-type">${escapeHtml(typeDisplay)}</span></td>` +
      `<td class="constraint-cell">${constraintHtml}</td>` +
      `<td>${docHtml}</td>` +
      `</tr>\n`;

    if (prop.type.kind === "object") {
      html += generatePropertyRows(prop.type.properties, level + 1);
    }
    if (
      prop.type.kind === "array" &&
      prop.type.elementType.kind === "object"
    ) {
      html += generatePropertyRows(prop.type.elementType.properties, level + 1);
    }
  }
  return html;
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

  const cAny = c as Record<string, unknown>;
  if (cAny.minimum !== undefined || cAny.maximum !== undefined) {
    const min = cAny.minimum !== undefined ? String(cAny.minimum) : "";
    const max = cAny.maximum !== undefined ? String(cAny.maximum) : "";
    const expr = min && max ? `[${min}, ${max}]` : min ? `≥ ${min}` : `≤ ${max}`;
    lines.push(`<span class="constraint-item">值域 ${expr}</span>`);
  }
  if (cAny.minLength !== undefined || cAny.maxLength !== undefined) {
    const min = cAny.minLength !== undefined ? String(cAny.minLength) : "";
    const max = cAny.maxLength !== undefined ? String(cAny.maxLength) : "";
    const expr = min && max ? `[${min}, ${max}]` : min ? `≥ ${min}` : `≤ ${max}`;
    lines.push(`<span class="constraint-item">长度 ${expr}</span>`);
  }

  if (cAny.pattern !== undefined) {
    lines.push(`<span class="constraint-item">格式 /${cAny.pattern}/</span>`);
  }

  return lines.join("<br>");
}
