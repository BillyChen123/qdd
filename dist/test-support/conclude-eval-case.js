import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(moduleDir, '..', '..');
export const CONCLUDE_EVAL_CASES_ROOT = path.join(packageRoot, 'src', 'test', 'fixtures', 'conclude');
export const DEFAULT_CONCLUDE_EVAL_CASE = 'sdk-two-gate';
function requireString(value, field) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`Conclude eval case field ${field} must be a non-empty string.`);
    }
    return value;
}
function requireStrings(value, field) {
    if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
        throw new Error(`Conclude eval case field ${field} must be a non-empty string array.`);
    }
    return value;
}
function validateCase(raw) {
    if (!raw || typeof raw !== 'object')
        throw new Error('Conclude eval case manifest must be an object.');
    const value = raw;
    if (value.schema_version !== 1)
        throw new Error('Conclude eval case schema_version must be 1.');
    const provenance = value.provenance;
    const gates = value.gates;
    if (!provenance || !gates)
        throw new Error('Conclude eval case requires provenance and gates.');
    return {
        schema_version: 1,
        id: requireString(value.id, 'id'),
        name: requireString(value.name, 'name'),
        run_id: requireString(value.run_id, 'run_id'),
        provenance: {
            kind: requireString(provenance.kind, 'provenance.kind'),
            source: requireString(provenance.source, 'provenance.source'),
            notes: requireString(provenance.notes, 'provenance.notes'),
        },
        navigation_files: requireStrings(value.navigation_files, 'navigation_files'),
        evidence_outputs: requireStrings(value.evidence_outputs, 'evidence_outputs'),
        unpromoted_finalized_outputs: requireStrings(value.unpromoted_finalized_outputs, 'unpromoted_finalized_outputs'),
        figures: requireStrings(value.figures, 'figures'),
        gates: {
            gate1_feedback: requireString(gates.gate1_feedback, 'gates.gate1_feedback'),
            gate1_acceptance: requireString(gates.gate1_acceptance, 'gates.gate1_acceptance'),
            gate2_feedback: requireString(gates.gate2_feedback, 'gates.gate2_feedback'),
            gate2_acceptance: requireString(gates.gate2_acceptance, 'gates.gate2_acceptance'),
        },
        reviewer_focus: requireStrings(value.reviewer_focus, 'reviewer_focus'),
    };
}
function resolveCaseRoot(casePath) {
    if (!casePath)
        return path.join(CONCLUDE_EVAL_CASES_ROOT, DEFAULT_CONCLUDE_EVAL_CASE);
    const direct = path.resolve(casePath);
    return path.isAbsolute(casePath) || casePath.startsWith('.') || casePath.includes(path.sep)
        ? direct
        : path.join(CONCLUDE_EVAL_CASES_ROOT, casePath);
}
async function collectFiles(root, current = root) {
    const files = [];
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        if (entry.name === 'conclusions' || entry.name === '.claude' || entry.name === '.codex')
            continue;
        const absolutePath = path.join(current, entry.name);
        if (entry.isDirectory())
            files.push(...await collectFiles(root, absolutePath));
        else if (entry.isFile())
            files.push(path.relative(root, absolutePath).split(path.sep).join('/'));
    }
    return files;
}
export async function loadConcludeEvalCase(casePath) {
    const root = resolveCaseRoot(casePath);
    const manifestPath = path.join(root, 'eval-case.yaml');
    const definition = validateCase(parse(await fs.readFile(manifestPath, 'utf-8')));
    const hash = createHash('sha256');
    for (const relativePath of await collectFiles(root)) {
        hash.update(relativePath);
        hash.update('\0');
        hash.update(await fs.readFile(path.join(root, relativePath)));
        hash.update('\0');
    }
    const requiredPaths = new Set([
        ...definition.navigation_files,
        ...definition.evidence_outputs,
        ...definition.unpromoted_finalized_outputs,
        ...definition.figures,
    ]);
    for (const relativePath of requiredPaths) {
        await fs.access(path.join(root, relativePath));
    }
    return { root, manifestPath, definition, fingerprint: hash.digest('hex') };
}
//# sourceMappingURL=conclude-eval-case.js.map