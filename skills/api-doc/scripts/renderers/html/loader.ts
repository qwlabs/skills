import { RenderFn } from './base';
import { text } from './text';
import { badge } from './badge';
import { tag } from './tag';
import { code } from './code';
import { link } from './link';
import { copy } from './copy';

const renderMap: Record<string, RenderFn> = {
  text,
  badge,
  tag,
  code,
  link,
  copy,
};

export async function getRender(name: string): Promise<RenderFn | null> {
  return renderMap[name] ?? null;
}

export async function renderAsync(name: string, value: any, options?: any): Promise<string> {
  const fn = await getRender(name);
  if (!fn) return String(value);
  const result = await fn(value, options);
  return result.html;
}

export function render(name: string, value: any, options?: any): string {
  const fn = renderMap[name];
  if (!fn) return String(value);
  return fn(value, options).html;
}

export function listRenders(): { name: string; description: string }[] {
  const descriptions: Record<string, string> = {
    text: '纯文本',
    badge: '彩色徽章',
    tag: '带颜色的标签',
    code: '行内代码',
    link: '链接',
    copy: '可点击复制',
  };
  return Object.keys(renderMap).map((name) => ({
    name,
    description: descriptions[name] || name,
  }));
}

export async function preloadRenders(): Promise<void> {
  // Static imports already loaded — no-op
}
