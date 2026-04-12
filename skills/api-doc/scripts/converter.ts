import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, extname, relative } from 'path';
import { fileURLToPath } from 'url';
import { render, preloadRenders } from '../renders/loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============ Types ============

interface FieldSchema {
    type: string;
    description: string;
    default?: any;
    enum?: string[];
    pattern?: string;
    maximum?: number;
    minimum?: number;
    maxLength?: number;
    required?: boolean;
    items?: FieldSchema;
    properties?: Record<string, FieldSchema>;
}

interface ParameterSchema {
    type: string;
    properties?: Record<string, FieldSchema>;
    required?: string[];
    items?: FieldSchema;
}

interface MetadataEntry {
    value: any;
    render: string;
    title?: string;       // Custom display label (e.g., "请求方法" instead of "method")
    options?: Record<string, any>;
}

interface ApiSection {
    title: string;
    group: string;
    metadata: Record<string, MetadataEntry>;
    scenarios: string[];
    preconditionItems: string[];
    postResultItems: string[];
    requestSchema: ParameterSchema | null;
    responseSchema: ParameterSchema | null;
    requestExample: string;
    responseExample: string;
    isOverallDescription?: boolean;
    filePath?: string;
}

// ============ YAML/Schema Parser ============

function parseValue(str: string): any {
    const trimmed = str.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null' || trimmed === '~') return null;
    if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return trimmed.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    }
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
    return trimmed;
}

function getIndent(line: string): number {
    return line.search(/\S/);
}

function parseYamlBlock(text: string): ParameterSchema {
    const schema: ParameterSchema = { type: 'object', properties: {} };
    const lines = text.split('\n').filter(l => l !== undefined);
    let i = 0;
    
    while (i < lines.length && !lines[i].trim()) i++;
    if (i >= lines.length) return schema;
    
    const firstLine = lines[i].trim();
    if (firstLine.startsWith('type:')) {
        schema.type = firstLine.split(':')[1].trim();
        i++;
    }
    
    while (i < lines.length && !lines[i].includes('properties:')) i++;
    if (i >= lines.length) return schema;
    i++;
    
    while (i < lines.length && !lines[i].trim()) i++;
    if (i >= lines.length) return schema;
    
    const baseIndent = getIndent(lines[i]);
    
    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();
        const indent = getIndent(line);
        
        if (!trimmed || trimmed.startsWith('#')) { i++; continue; }
        if (indent < baseIndent) break;
        if (indent === baseIndent && !trimmed.includes(':')) break;
        
        if (indent === baseIndent && trimmed.startsWith('required:')) {
            const reqStr = trimmed.split(':')[1].trim();
            if (reqStr.startsWith('[')) {
                schema.required = reqStr.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
            }
            i++;
            continue;
        }
        
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx <= 0) { i++; continue; }
        
        const propName = trimmed.substring(0, colonIdx).trim();
        const afterColon = trimmed.substring(colonIdx + 1).trim();
        i++;
        
        if (!afterColon) {
            const field: FieldSchema = { type: 'string', description: '' };
            
            while (i < lines.length && !lines[i].trim()) i++;
            
            if (i < lines.length) {
                while (i < lines.length) {
                    const childLine = lines[i].trim();
                    const childIndent = getIndent(lines[i]);
                    
                    if (!childLine || childLine.startsWith('#')) { i++; continue; }
                    if (childIndent <= baseIndent) break;
                    
                    const childColonIdx = childLine.indexOf(':');
                    if (childColonIdx <= 0) { i++; continue; }
                    
                    const childKey = childLine.substring(0, childColonIdx).trim();
                    const childValue = childLine.substring(childColonIdx + 1).trim();
                    i++;
                    
                    if (!childValue) {
                        if (childKey === 'items') {
                            const itemsField: FieldSchema = { type: 'string', description: '' };
                            while (i < lines.length && !lines[i].trim()) i++;
                            const itemsIndent = getIndent(lines[i]);
                            while (i < lines.length) {
                                const itemLine = lines[i].trim();
                                const itemIndent = getIndent(lines[i]);
                                if (itemIndent <= itemsIndent) break;
                                
                                const itemColonIdx = itemLine.indexOf(':');
                                if (itemColonIdx > 0) {
                                    const itemKey = itemLine.substring(0, itemColonIdx).trim();
                                    const itemValue = itemLine.substring(itemColonIdx + 1).trim();
                                    if (itemKey === 'type') itemsField.type = itemValue;
                                    else if (itemKey === 'description') itemsField.description = itemValue;
                                }
                                i++;
                            }
                            field.items = itemsField;
                        }
                        else if (childKey === 'properties') {
                            const nestedProps: Record<string, FieldSchema> = {};
                            i++;
                            while (i < lines.length) {
                                const nLine = lines[i].trim();
                                const nIndent = getIndent(lines[i]);
                                if (nIndent <= childIndent) break;
                                
                                const nColonIdx = nLine.indexOf(':');
                                if (nColonIdx > 0) {
                                    const nKey = nLine.substring(0, nColonIdx).trim();
                                    const nValue = nLine.substring(nColonIdx + 1).trim();
                                    i++;
                                    
                                    if (!nValue) {
                                        const nField: FieldSchema = { type: 'string', description: '' };
                                        i++;
                                        while (i < lines.length) {
                                            const nnLine = lines[i].trim();
                                            const nnIndent = getIndent(lines[i]);
                                            if (nnIndent <= nIndent) break;
                                            
                                            const nnColonIdx = nnLine.indexOf(':');
                                            if (nnColonIdx > 0) {
                                                const nnKey = nnLine.substring(0, nnColonIdx).trim();
                                                const nnValue = nnLine.substring(nnColonIdx + 1).trim();
                                                if (nnKey === 'type') nField.type = nnValue;
                                                else if (nnKey === 'description') nField.description = nnValue;
                                            }
                                            i++;
                                        }
                                        nestedProps[nKey] = nField;
                                    } else {
                                        nestedProps[nKey] = { type: 'string', description: nValue };
                                    }
                                } else {
                                    i++;
                                }
                            }
                            field.properties = nestedProps;
                        }
                    } else {
                        if (childKey === 'type') field.type = childValue;
                        else if (childKey === 'description') field.description = childValue;
                        else if (childKey === 'default') field.default = parseValue(childValue);
                        else if (childKey === 'enum') field.enum = childValue.slice(1, -1).split(',').map(s => s.trim());
                        else if (childKey === 'pattern') field.pattern = childValue.replace(/^["']|["']$/g, '');
                        else if (childKey === 'maximum') field.maximum = parseValue(childValue);
                        else if (childKey === 'minimum') field.minimum = parseValue(childValue);
                        else if (childKey === 'maxLength') field.maxLength = parseValue(childValue);
                        else if (childKey === 'required') field.required = childValue === 'true';
                    }
                }
            }
            
            schema.properties![propName] = field;
        } else {
            schema.properties![propName] = { type: 'string', description: afterColon };
        }
    }
    
    return schema;
}

// ============ Front-matter Parser ============

interface FrontMatter {
    title?: string;
    metadata?: Record<string, MetadataEntry>;
    [key: string]: any;
}

function parseFrontMatter(content: string): { frontMatter: FrontMatter; body: string } {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (!fmMatch) {
        return { frontMatter: {}, body: content };
    }
    
    const fmText = fmMatch[1];
    const body = fmMatch[2];
    const fm: FrontMatter = {};
    
    const lines = fmText.split('\n');
    let i = 0;
    
    while (i < lines.length) {
        const line = lines[i].trim();
        if (!line) { i++; continue; }
        
        const colonIdx = line.indexOf(':');
        if (colonIdx <= 0) { i++; continue; }
        
        const key = line.substring(0, colonIdx).trim();
        const rest = line.substring(colonIdx + 1).trim();
        i++;
        
        if (!rest || rest === '') {
            // Multi-line object
            const obj: any = {};
            const baseIndent = lines[i] ? getIndent(lines[i]) : 0;
            
            while (i < lines.length) {
                const currentLine = lines[i].trim();
                const currentIndent = getIndent(lines[i]);
                
                if (!currentLine || currentLine.startsWith('#')) { i++; continue; }
                // Break when we're back to parent level (strictly less than parent indent)
                if (currentIndent < baseIndent) break;
                
                const objColonIdx = currentLine.indexOf(':');
                if (objColonIdx > 0) {
                    const objKey = currentLine.substring(0, objColonIdx).trim();
                    const objValue = currentLine.substring(objColonIdx + 1).trim();
                    i++;
                    
                    if (!objValue) {
                        // Check for inline object like { value: xxx, render: yyy } on NEXT line
                        if (lines[i]?.includes('{')) {
                            const inline = lines[i].trim();
                            const match = inline.match(/^\{([^}]+)\}$/);
                            if (match) {
                                const pairs = match[1].split(',').map(s => {
                                    const [k, v] = s.split(':').map(x => x.trim());
                                    return [k, v];
                                });
                                for (const [k, v] of pairs) {
                                    obj[objKey] = obj[objKey] || {};
                                    obj[objKey][k] = v.replace(/^["']|["']$/g, '');
                                }
                                i++;
                            }
                        }
                    } else if (objValue.startsWith('{') && objValue.endsWith('}')) {
                        // objValue ITSELF is an inline object like "{ value: xxx, render: yyy }"
                        const match = objValue.match(/^\{([^}]+)\}$/);
                        if (match) {
                            const pairs = match[1].split(',').map(s => {
                                const [k, v] = s.split(':').map(x => x.trim());
                                return [k, v];
                            });
                            for (const [k, v] of pairs) {
                                obj[objKey] = obj[objKey] || {};
                                obj[objKey][k] = v.replace(/^["']|["']$/g, '');
                            }
                        } else {
                            obj[objKey] = objValue.replace(/^["']|["']$/g, '');
                        }
                    } else {
                        obj[objKey] = objValue.replace(/^["']|["']$/g, '');
                    }
                } else {
                    i++;
                }
            }
            
            fm[key] = obj;
        } else {
            fm[key] = rest.replace(/^["']|["']$/g, '');
        }
    }
    
    return { frontMatter: fm, body };
}

// ============ Markdown Parser ============

function parseMarkdownToApiSections(
    markdown: string,
    filePath: string = '',
    defaultGroup: string = '',
    globalMetadata: Record<string, MetadataEntry> = {}
): ApiSection[] {
    const { frontMatter, body } = parseFrontMatter(markdown);
    const lines = body.split('\n');
    const sections: ApiSection[] = [];
    let currentSection: Partial<ApiSection> | null = null;
    let inSchemaBlock = false;
    let schemaBuffer: string[] = [];
    let schemaType: 'request' | 'response' | null = null;
    let currentListField: string | null = null;
    let currentListItems: string[] = [];

    function saveListItems() {
        if (currentSection && currentListItems.length > 0 && currentListField) {
            if (currentListField === 'scenarios') currentSection.scenarios = [...currentListItems];
            else if (currentListField === 'precondition') currentSection.preconditionItems = [...currentListItems];
            else if (currentListField === 'postResult') currentSection.postResultItems = [...currentListItems];
            currentListItems = [];
            currentListField = null;
        }
    }

    function saveSchemaBlock() {
        if (schemaBuffer.length > 0 && schemaType && currentSection) {
            const schemaText = schemaBuffer.join('\n');
            const parsed = parseYamlBlock(schemaText);
            if (schemaType === 'request') currentSection.requestSchema = parsed;
            else currentSection.responseSchema = parsed;
        }
        schemaBuffer = [];
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Handle API section header - either from ### markdown header or front-matter title
        if (trimmedLine.startsWith('### ')) {
            if (currentSection && currentSection.title) {
                saveListItems();
                saveSchemaBlock();
                sections.push(currentSection as ApiSection);
            }

            const title = trimmedLine.substring(4).trim();
            currentSection = {
                title,
                group: defaultGroup,
                metadata: mergeMetadata(globalMetadata, frontMatter.metadata || {}),
                scenarios: [],
                preconditionItems: [],
                postResultItems: [],
                requestSchema: null,
                responseSchema: null,
                requestExample: '',
                responseExample: '',
                isOverallDescription: title === '整体说明',
                filePath
            };
            currentListItems = [];
            currentListField = null;
            schemaBuffer = [];
            schemaType = null;
            inSchemaBlock = false;
            continue;
        }
        
        // If no current section and we have a front-matter title, create section
        if (!currentSection && frontMatter.title) {
            currentSection = {
                title: frontMatter.title,
                group: defaultGroup,
                metadata: mergeMetadata(globalMetadata, frontMatter.metadata || {}),
                scenarios: [],
                preconditionItems: [],
                postResultItems: [],
                requestSchema: null,
                responseSchema: null,
                requestExample: '',
                responseExample: '',
                isOverallDescription: false,
                filePath
            };
            currentListItems = [];
            currentListField = null;
            schemaBuffer = [];
            schemaType = null;
            inSchemaBlock = false;
        }

        if (!currentSection) continue;

        // Handle indented list items (metadata continuation)
        const indentedMatch = line.match(/^(\s{2,3})- (.+)$/);
        if (indentedMatch && currentListField) {
            currentListItems.push(indentedMatch[2].trim());
            continue;
        }

        // Handle top-level list items
        if (trimmedLine.startsWith('- ')) {
            const content = trimmedLine.substring(2);
            const colonIdx = content.indexOf(':');
            
            if (colonIdx > 0) {
                const key = content.substring(0, colonIdx).trim();
                const value = content.substring(colonIdx + 1).trim();
                
                if (key === '应用场景') { saveListItems(); currentListField = 'scenarios'; currentListItems = []; }
                else if (key === '请求前置条件') { saveListItems(); currentListField = 'precondition'; currentListItems = []; }
                else if (key === '请求后结果') { saveListItems(); currentListField = 'postResult'; currentListItems = []; }
            }
        }
        // Handle example blocks (JSON) - MUST come before schema blocks
        else if (trimmedLine.startsWith('```json')) {
            saveListItems();
            i++;
            const exampleLines: string[] = [];
            while (i < lines.length && lines[i].trim() !== '```') {
                exampleLines.push(lines[i]);
                i++;
            }
            const example = exampleLines.join('\n').trim();
            const prevLine = lines[i - exampleLines.length - 1]?.trim();
            
            if (prevLine?.includes('请求示例') || prevLine?.includes('请求')) {
                currentSection.requestExample = example;
            } else if (prevLine?.includes('响应示例') || prevLine?.includes('响应')) {
                currentSection.responseExample = example;
            } else if (!currentSection.requestExample) {
                currentSection.requestExample = example;
            } else if (!currentSection.responseExample) {
                currentSection.responseExample = example;
            }
        }
        // Handle Schema blocks (YAML only)
        else if (trimmedLine.startsWith('```yaml')) {
            saveListItems();
            inSchemaBlock = true;
            schemaBuffer = [];
            const prevLine = lines[i - 1]?.trim();
            if (prevLine?.includes('请求参数')) schemaType = 'request';
            else if (prevLine?.includes('响应参数')) schemaType = 'response';
        }
        else if (trimmedLine === '```') {
            if (inSchemaBlock) {
                saveSchemaBlock();
                inSchemaBlock = false;
                schemaType = null;
            }
        }
        else if (inSchemaBlock) {
            schemaBuffer.push(line);
        }
    }

    if (currentSection && currentSection.title) {
        saveListItems();
        saveSchemaBlock();
        sections.push(currentSection as ApiSection);
    }

    return sections;
}

// ============ Multi-file Support ============

interface FileInfo {
    path: string;
    content: string;
    group: string;
}

function scanMarkdownFiles(dir: string): FileInfo[] {
    const files: FileInfo[] = [];
    
    function scan(currentDir: string) {
        const entries = readdirSync(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = join(currentDir, entry.name);
            
            if (entry.isDirectory()) {
                if (!entry.name.startsWith('_')) scan(fullPath);
            } else if (entry.isFile() && extname(entry.name) === '.md') {
                if (entry.name.toLowerCase() === 'index.md' || entry.name.toLowerCase() === 'readme.md') continue;
                
                const relPath = relative(dir, fullPath);
                const parts = relPath.split('/');
                let group = '';
                if (parts.length > 1) group = parts[0];
                
                files.push({ path: fullPath, content: readFileSync(fullPath, 'utf-8'), group });
            }
        }
    }
    
    scan(dir);
    return files;
}

/**
 * Merge global metadata with API-specific metadata.
 *
 * Global (index.md) defines rendering config: { render, title, options }
 * Local (API file) provides values: { value } or just simple value
 *
 * If API file only provides a simple value, it uses global's render config.
 * If API file provides full object, it can override render config.
 */
function mergeMetadata(
    global: Record<string, MetadataEntry>,
    local: Record<string, any>
): Record<string, MetadataEntry> {
    const result: Record<string, MetadataEntry> = {};

    // Start with global entries (they provide render config)
    for (const [key, globalEntry] of Object.entries(global)) {
        if (typeof globalEntry === 'object' && globalEntry !== null) {
            result[key] = { ...globalEntry };
        } else {
            result[key] = { value: globalEntry, render: 'text' };
        }
    }

    // Merge local entries
    for (const [key, localEntry] of Object.entries(local)) {
        if (result[key]) {
            // Global exists: local provides value, global provides render config (unless overridden)
            const isSimpleValue = typeof localEntry !== 'object' || localEntry === null;

            if (isSimpleValue) {
                // Simple value: use global's render config
                result[key] = {
                    ...result[key],
                    value: localEntry,
                };
            } else {
                // Object: local may override render config
                result[key] = {
                    // Preserve global render/title if not specified in local
                    render: localEntry.render || result[key].render,
                    title: localEntry.title !== undefined ? localEntry.title : result[key].title,
                    options: localEntry.options || result[key].options,
                    // Value always from local
                    value: localEntry.value,
                };
            }
        } else {
            // Only local exists
            if (typeof localEntry === 'object' && localEntry !== null) {
                result[key] = { render: 'text', ...localEntry };
            } else {
                result[key] = { value: localEntry, render: 'text' };
            }
        }
    }

    return result;
}

function parseMultiFile(dir: string): ApiSection[] {
    const allSections: ApiSection[] = [];
    const globalMetadata: Record<string, MetadataEntry> = {};
    
    const indexPath = join(dir, 'index.md');
    const readmePath = join(dir, 'README.md');
    
    // Extract global metadata from index.md
    if (existsSync(indexPath)) {
        const indexContent = readFileSync(indexPath, 'utf-8');
        const { frontMatter } = parseFrontMatter(indexContent);
        Object.assign(globalMetadata, frontMatter.metadata || {});
        
        const sections = parseMarkdownToApiSections(indexContent, 'index.md', '', {});
        allSections.push(...sections.filter(s => s.isOverallDescription));
    } else if (existsSync(readmePath)) {
        const readmeContent = readFileSync(readmePath, 'utf-8');
        const { frontMatter } = parseFrontMatter(readmeContent);
        Object.assign(globalMetadata, frontMatter.metadata || {});
        
        const sections = parseMarkdownToApiSections(readmeContent, 'readme.md', '', {});
        allSections.push(...sections.filter(s => s.isOverallDescription));
    }
    
    const files = scanMarkdownFiles(dir);
    files.sort((a, b) => a.path.localeCompare(b.path));
    
    for (const file of files) {
        const sections = parseMarkdownToApiSections(file.content, file.path, file.group, globalMetadata);
        allSections.push(...sections.filter(s => !s.isOverallDescription));
    }
    
    return allSections;
}

// ============ HTML Generator ============

function escapeHtml(text: string): string {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function generateFieldRows(schema: ParameterSchema | null, parentPath: string = '', level: number = 0): string {
    if (!schema || !schema.properties) return '';
    
    let html = '';
    const requiredFields = schema.required || [];
    
    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
        const fullPath = parentPath ? `${parentPath}.${fieldName}` : fieldName;
        const isRequired = requiredFields.includes(fieldName);
        const indentClass = 'field-indent-' + Math.min(level, 4);
        
        let typeDisplay = fieldSchema.type || 'string';
        if (fieldSchema.type === 'array' && fieldSchema.items) {
            if (fieldSchema.items.type === 'object' && fieldSchema.items.properties) {
                typeDisplay = 'array<object>';
            } else {
                typeDisplay = `array<${fieldSchema.items.type || 'any'}>`;
            }
        }
        
        const constraints: string[] = [];
        if (fieldSchema.enum) constraints.push(`枚举: ${fieldSchema.enum.join(', ')}`);
        if (fieldSchema.pattern) constraints.push(`格式: ${fieldSchema.pattern}`);
        if (fieldSchema.maximum !== undefined) constraints.push(`最大值: ${fieldSchema.maximum}`);
        if (fieldSchema.minimum !== undefined) constraints.push(`最小值: ${fieldSchema.minimum}`);
        if (fieldSchema.maxLength !== undefined) constraints.push(`最大长度: ${fieldSchema.maxLength}`);
        
        let requiredBadge = '';
        if (isRequired) requiredBadge = '<span class="field-required">必填</span>';
        else if (fieldSchema.default !== undefined) requiredBadge = '<span class="field-optional">选填</span>';
        
        const defaultDisplay = fieldSchema.default !== undefined ? String(fieldSchema.default) : '';
        
        html += '<tr>';
        html += `<td class="field-name-cell ${indentClass}"><code class="field-name">${escapeHtml(fieldName)}</code></td>`;
        html += `<td><span class="field-type">${escapeHtml(typeDisplay)}</span></td>`;
        html += `<td>${escapeHtml(fieldSchema.description || '')}</td>`;
        html += `<td>${requiredBadge}</td>`;
        html += `<td>${escapeHtml(defaultDisplay)}</td>`;
        html += `<td>${escapeHtml(constraints.join(' | '))}</td>`;
        html += '</tr>\n';
        
        if (fieldSchema.type === 'object' && fieldSchema.properties) {
            html += generateFieldRows({ type: 'object', properties: fieldSchema.properties, required: [] }, fullPath, level + 1);
        }
        
        if (fieldSchema.type === 'array' && fieldSchema.items && fieldSchema.items.properties) {
            html += generateFieldRows({ type: 'object', properties: fieldSchema.items.properties, required: [] }, `${fullPath}[]`, level + 1);
        }
    }
    
    return html;
}

function generateSidebarContent(sections: ApiSection[]): string {
    const groups: Record<string, ApiSection[]> = {};
    
    for (const section of sections) {
        if (section.isOverallDescription) continue;
        const group = section.group || '其他';
        if (!groups[group]) groups[group] = [];
        groups[group].push(section);
    }
    
    let html = '';
    
    if (sections.find(s => s.isOverallDescription)) {
        html += '<li class="toc-item"><a href="#overall-description" class="toc-link">整体说明</a></li>\n';
    }
    
    for (const [groupName, groupSections] of Object.entries(groups)) {
        html += `<li class="toc-group"><div class="toc-group-title">${escapeHtml(groupName)}</div></li>\n`;
        for (const section of groupSections) {
            const anchorId = 'api-' + section.title.replace(/\s+/g, '-');
            html += `<li class="toc-item"><a href="#${anchorId}" class="toc-link">${escapeHtml(section.title)}</a></li>\n`;
        }
    }
    
    return html;
}

function generateMetadataHtml(metadata: Record<string, MetadataEntry>): string {
    let html = '<div class="meta-section">\n';
    
    for (const [key, entry] of Object.entries(metadata)) {
        // Skip if no value (e.g., global-only fields that weren't overridden)
        if (entry.value === undefined || entry.value === null) continue;
        
        const renderType = entry.render || 'text';
        const options = entry.options || {};
        const label = entry.title || key;  // Use custom title if provided, else use key
        const htmlContent = render(renderType, entry.value, options);
        html += `<div class="meta-block"><span class="meta-label">${escapeHtml(label)}</span><span class="meta-value">${htmlContent}</span></div>`;
    }
    
    html += '</div>';
    return html;
}

function generateApiContent(sections: ApiSection[], version: string): string {
    let html = '';
    
    for (const section of sections) {
        if (section.isOverallDescription) {
            html += '<section class="api-section" id="overall-description">\n';
            html += `<div class="api-title">${escapeHtml(section.title)}</div>\n`;
            if (section.scenarios?.length) {
                for (const groupName of section.scenarios) {
                    html += `<div class="section">\n<div class="section-title">${escapeHtml(groupName)}</div>\n</div>\n`;
                }
            }
            html += '</section>\n';
            continue;
        }
        
        const anchorId = 'api-' + section.title.replace(/\s+/g, '-');
        
        html += `<section class="api-section" id="${anchorId}">\n`;
        html += `<div class="api-title">${escapeHtml(section.title)}</div>\n`;
        
        // Render metadata using registered renders
        html += generateMetadataHtml(section.metadata);
        
        if (section.scenarios?.length) {
            html += '<div class="section"><div class="section-title">应用场景</div><ul class="list">\n';
            for (const s of section.scenarios) html += `<li>${escapeHtml(s)}</li>\n`;
            html += '</ul></div>';
        }
        
        if (section.preconditionItems?.length) {
            html += '<div class="section"><div class="section-title">请求前置条件</div><ul class="list">\n';
            for (const s of section.preconditionItems) html += `<li>${escapeHtml(s)}</li>\n`;
            html += '</ul></div>';
        }
        
        if (section.postResultItems?.length) {
            html += '<div class="section"><div class="section-title">请求后结果</div><ul class="list">\n';
            for (const s of section.postResultItems) html += `<li>${escapeHtml(s)}</li>\n`;
            html += '</ul></div>';
        }
        
        if (section.requestSchema?.properties && Object.keys(section.requestSchema.properties).length > 0) {
            html += '<div class="section"><div class="section-title">请求参数</div>\n';
            html += '<table class="param-table"><thead><tr><th>字段名</th><th>类型</th><th>说明</th><th>必填</th><th>默认值</th><th>约束</th></tr></thead><tbody>\n';
            html += generateFieldRows(section.requestSchema);
            html += '</tbody></table></div>';
        }
        
        if (section.requestExample) {
            html += '<div class="json-section">\n';
            html += '<div class="json-title">请求示例</div>\n';
            html += `<div class="json-block"><pre><code class="language-json">${escapeHtml(section.requestExample)}</code></pre></div>\n`;
            html += '</div>';
        }
        
        if (section.responseSchema?.properties && Object.keys(section.responseSchema.properties).length > 0) {
            html += '<div class="section"><div class="section-title">响应参数</div>\n';
            html += '<table class="param-table"><thead><tr><th>字段名</th><th>类型</th><th>说明</th><th>必填</th><th>默认值</th><th>约束</th></tr></thead><tbody>\n';
            html += generateFieldRows(section.responseSchema);
            html += '</tbody></table></div>';
        }
        
        if (section.responseExample) {
            html += '<div class="json-section">\n';
            html += '<div class="json-title">响应示例</div>\n';
            html += `<div class="json-block"><pre><code class="language-json">${escapeHtml(section.responseExample)}</code></pre></div>\n`;
            html += '</div>';
        }
        
        html += '</section>\n';
    }
    
    html += `<footer class="doc-footer">文档版本: ${escapeHtml(version)}</footer>\n`;
    
    return html;
}

function loadTemplate(): string {
    const templatePath = join(__dirname, '..', 'assets', 'template.html');
    if (existsSync(templatePath)) return readFileSync(templatePath, 'utf-8');
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
</head>
<body>{{api_content}}</body>
</html>`;
}

function getVersion(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `v1.0.0-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function convertInput(inputPath: string, outputPath: string) {
    if (!existsSync(inputPath)) {
        console.error('Input path not found: ' + inputPath);
        process.exit(1);
    }
    
    const isDir = readdirSync(inputPath, { withFileTypes: true })[0] !== undefined;
    const title = isDir ? inputPath.split('/').pop() || 'API文档' : inputPath.split('/').pop()?.replace('.md', '') || 'API文档';
    const version = getVersion();
    
    let sections: ApiSection[];
    
    if (isDir) {
        console.log('Scanning directory: ' + inputPath);
        sections = parseMultiFile(inputPath);
    } else {
        console.log('Reading: ' + inputPath);
        sections = parseMarkdownToApiSections(readFileSync(inputPath, 'utf-8'), inputPath, '');
    }
    
    console.log('Found ' + sections.length + ' sections');
    
    let apiCount = 0;
    for (const section of sections) {
        if (!section.isOverallDescription) {
            apiCount++;
            const reqCount = section.requestSchema?.properties ? Object.keys(section.requestSchema.properties).length : 0;
            const resCount = section.responseSchema?.properties ? Object.keys(section.responseSchema.properties).length : 0;
            console.log(`  - [${section.group || '默认'}] ${section.title} (req:${reqCount} res:${resCount})`);
        }
    }
    console.log(`Total: ${apiCount} APIs`);
    
    console.log('Generating HTML...');
    const template = loadTemplate();
    const sidebarContent = generateSidebarContent(sections);
    const apiContent = generateApiContent(sections, version);
    
    let html = template
        .replace(/\{\{title\}\}/g, escapeHtml(title))
        .replace(/\{\{sidebar_content\}\}/g, sidebarContent)
        .replace(/\{\{api_content\}\}/g, apiContent)
        .replace(/\{\{version\}\}/g, version);
    
    console.log('Writing: ' + outputPath);
    writeFileSync(outputPath, html, 'utf-8');
    console.log('Done! Version: ' + version);
}

// ============ CLI ============

async function main() {
    await preloadRenders();
    
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log('Usage: bun run converter.ts <input> <output-html>');
        console.log('  <input>: markdown file or directory with index.md');
        console.log('');
        console.log('Available renders:');
        const renders = [{ name: 'text', desc: '纯文本' }, { name: 'badge', desc: '彩色徽章' }, { name: 'tag', desc: '带颜色的标签' }, { name: 'code', desc: '行内代码' }, { name: 'link', desc: '链接' }, { name: 'copy', desc: '可点击复制' }];
        for (const r of renders) {
            console.log(`  - ${r.name}: ${r.desc}`);
        }
        process.exit(1);
    }
    
    convertInput(args[0], args[1]);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
