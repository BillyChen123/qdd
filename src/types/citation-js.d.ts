declare module '@citation-js/core' {
  export class Cite {
    constructor(data?: unknown);
    data: Array<Record<string, unknown>>;
    format(format: string, options?: Record<string, unknown>): string;
  }
}

declare module '@citation-js/plugin-bibtex';
