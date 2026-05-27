import { parse, stringify } from 'yaml';
export function parseYaml(content) {
    return parse(content);
}
export function stringifyYaml(value) {
    return stringify(value, {
        indent: 2,
        lineWidth: 0,
        minContentWidth: 0,
    });
}
//# sourceMappingURL=yaml.js.map