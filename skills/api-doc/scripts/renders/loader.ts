import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { RenderFn, RenderResult } from './base.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface RenderEntry {
    file: string;
    description: string;
    options?: Record<string, any>;
}

interface Registry {
    [name: string]: RenderEntry;
}

// Cache loaded renders
const renderCache: Map<string, RenderFn> = new Map();

// Pre-loaded built-in renders
const builtins: Record<string, RenderFn> = {};

// Dynamic import cache
const importCache: Map<string, any> = new Map();

async function loadBuiltin(name: string): Promise<RenderFn | null> {
    switch (name) {
        case 'text':
            return async () => {
                const { text } = await import('./text.js');
                return text;
            };
        case 'badge':
            return async () => {
                const { badge } = await import('./badge.js');
                return badge;
            };
        case 'tag':
            return async () => {
                const { tag } = await import('./tag.js');
                return tag;
            };
        case 'code':
            return async () => {
                const { code } = await import('./code.js');
                return code;
            };
        case 'link':
            return async () => {
                const { link } = await import('./link.js');
                return link;
            };
        case 'copy':
            return async () => {
                const { copy } = await import('./copy.js');
                return copy;
            };
        default:
            return null;
    }
}

export function loadRegistry(): Registry {
    const registryPath = join(__dirname, 'registry.json');
    if (!existsSync(registryPath)) {
        console.warn('Warning: registry.json not found at', registryPath);
        return {};
    }
    return JSON.parse(readFileSync(registryPath, 'utf-8'));
}

export async function getRender(name: string): Promise<RenderFn | null> {
    if (renderCache.has(name)) {
        return renderCache.get(name)!;
    }
    
    // Try built-in renders first
    const builtinLoader = await loadBuiltin(name);
    if (builtinLoader) {
        const fn = await builtinLoader();
        renderCache.set(name, fn);
        return fn;
    }
    
    // Try custom renders from registry
    const registry = loadRegistry();
    const entry = registry[name];
    
    if (!entry) {
        console.warn(`Render "${name}" not found in registry`);
        return null;
    }
    
    const renderPath = join(__dirname, entry.file);
    if (!existsSync(renderPath)) {
        console.warn(`Render file not found: ${renderPath}`);
        return null;
    }
    
    try {
        const mod = await import(renderPath);
        const renderFn = mod.text || mod.badge || mod.tag || mod.code || mod.link || mod.copy || mod.default;
        
        if (typeof renderFn !== 'function') {
            console.warn(`Render "${name}" does not export a function`);
            return null;
        }
        
        renderCache.set(name, renderFn);
        return renderFn;
    } catch (err) {
        console.warn(`Failed to load render "${name}":`, err);
        return null;
    }
}

export async function renderAsync(name: string, value: any, options?: any): Promise<string> {
    const fn = await getRender(name);
    if (!fn) {
        return String(value); // fallback
    }
    const result = await fn(value, options);
    return result.html;
}

// Sync version for backward compatibility (uses cached renders only)
export function render(name: string, value: any, options?: any): string {
    const fn = renderCache.get(name);
    if (!fn) {
        return String(value); // fallback - will be correct after first async load
    }
    return fn(value, options).html;
}

export function listRenders(): { name: string; description: string }[] {
    const registry = loadRegistry();
    const builtins = ['text', 'badge', 'tag', 'code', 'link', 'copy'];
    const result: { name: string; description: string }[] = [];
    
    for (const name of builtins) {
        result.push({ name, description: getBuiltinDescription(name) });
    }
    
    for (const [name, entry] of Object.entries(registry)) {
        if (!builtins.includes(name)) {
            result.push({ name, description: entry.description });
        }
    }
    
    return result;
}

function getBuiltinDescription(name: string): string {
    const descriptions: Record<string, string> = {
        text: '纯文本',
        badge: '彩色徽章',
        tag: '带颜色的标签',
        code: '行内代码',
        link: '链接',
        copy: '可点击复制'
    };
    return descriptions[name] || name;
}

// Pre-load all built-in renders
export async function preloadRenders(): Promise<void> {
    const names = ['text', 'badge', 'tag', 'code', 'link', 'copy'];
    await Promise.all(names.map(name => getRender(name)));
}
