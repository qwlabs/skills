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

export function render(name: string, value: any, options?: any): string {
  const fn = renderMap[name];
  if (!fn) return String(value);
  return fn(value, options).html;
}
