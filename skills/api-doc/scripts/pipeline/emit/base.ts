// Render interface - all renders must implement this
export interface RenderResult {
  html: string;
}

export interface RenderOptions {
  escape?: boolean;  // Whether to escape HTML (default: true)
}

export type RenderFn = (value: any, options?: RenderOptions) => RenderResult;
