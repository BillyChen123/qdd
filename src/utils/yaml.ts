import { parse, stringify } from 'yaml';

export function parseYaml<T>(content: string): T {
  return parse(content) as T;
}

export function stringifyYaml(value: unknown): string {
  return stringify(value, {
    indent: 2,
    lineWidth: 0,
    minContentWidth: 0,
  });
}
