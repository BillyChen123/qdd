import path from 'node:path';
import * as fs from 'node:fs/promises';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
import { readYamlFile, writeYamlFile } from './store.js';
const BOUNDARY_ID_PATTERN = /^B\d{3}$/;
const STUDY_MEMORY_PATTERN = /^STUDY-\d{3}\.md$/;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function normalizeTextKey(value) {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
function nextBoundaryId(boundaries) {
    const highest = boundaries.reduce((max, boundary) => {
        const match = boundary.id.match(/^B(\d{3})$/);
        return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
    }, 0);
    return `B${String(highest + 1).padStart(3, '0')}`;
}
function normalizeBoundaryState(value) {
    return String(value ?? '').trim() === 'resolved' ? 'resolved' : 'open';
}
function normalizeBoundary(raw, index) {
    if (!isRecord(raw)) {
        throw new Error(`evolution.yaml boundaries#${index} must be an object.`);
    }
    const id = String(raw.id ?? '').trim();
    if (!BOUNDARY_ID_PATTERN.test(id)) {
        throw new Error(`evolution.yaml boundaries#${index} has invalid id '${id || 'undefined'}'. Expected BXXX.`);
    }
    const text = String(raw.text ?? '').trim();
    if (!text) {
        throw new Error(`evolution.yaml boundaries#${index} must include non-empty text.`);
    }
    const deps = Array.isArray(raw.deps)
        ? raw.deps.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0)
        : [];
    for (const dep of deps) {
        if (!BOUNDARY_ID_PATTERN.test(dep)) {
            throw new Error(`evolution.yaml boundaries#${index} has invalid dep '${dep}'. Expected BXXX.`);
        }
    }
    const weightValue = raw.weight === undefined ? undefined : Number(raw.weight);
    if (weightValue !== undefined && (!Number.isFinite(weightValue) || weightValue < 0)) {
        throw new Error(`evolution.yaml boundaries#${index} has invalid weight '${String(raw.weight)}'.`);
    }
    return {
        id,
        text,
        state: normalizeBoundaryState(raw.state),
        ...(deps.length > 0 ? { deps } : {}),
        ...(weightValue !== undefined ? { weight: weightValue } : {}),
    };
}
function normalizeStudyEvent(raw, index) {
    if (!isRecord(raw)) {
        throw new Error(`evolution.yaml studies#${index} must be an object.`);
    }
    const id = String(raw.id ?? '').trim();
    if (!/^STUDY-\d{3}$/.test(id)) {
        throw new Error(`evolution.yaml studies#${index} has invalid id '${id || 'undefined'}'. Expected STUDY-XXX.`);
    }
    const question = String(raw.question ?? '').trim();
    if (!question) {
        throw new Error(`evolution.yaml studies#${index} must include non-empty question.`);
    }
    const kind = String(raw.kind ?? '').trim();
    if (!['refinement', 'confirmation', 'pivot', 'dissolution'].includes(kind)) {
        throw new Error(`evolution.yaml studies#${index} has invalid kind '${kind || 'undefined'}'.`);
    }
    const resolves = Array.isArray(raw.resolves)
        ? raw.resolves.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0)
        : [];
    const opens = Array.isArray(raw.opens)
        ? raw.opens.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0)
        : [];
    const candidates = Array.isArray(raw.candidates)
        ? raw.candidates.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0)
        : [];
    const ts = String(raw.ts ?? '').trim();
    for (const boundaryId of [...resolves, ...opens]) {
        if (!BOUNDARY_ID_PATTERN.test(boundaryId)) {
            throw new Error(`evolution.yaml studies#${index} references invalid boundary id '${boundaryId}'. Expected BXXX.`);
        }
    }
    if (!ts) {
        throw new Error(`evolution.yaml studies#${index} must include non-empty ts.`);
    }
    return {
        id,
        question,
        kind: kind,
        resolves,
        opens,
        candidates,
        ts,
    };
}
function normalizeEvolutionState(raw) {
    if (!isRecord(raw)) {
        throw new Error('evolution.yaml must define an object.');
    }
    const studies = Array.isArray(raw.studies) ? raw.studies.map((entry, index) => normalizeStudyEvent(entry, index)) : [];
    const boundaries = Array.isArray(raw.boundaries)
        ? raw.boundaries.map((entry, index) => normalizeBoundary(entry, index))
        : [];
    const seenIds = new Set();
    for (const boundary of boundaries) {
        if (seenIds.has(boundary.id)) {
            throw new Error(`evolution.yaml contains duplicate boundary id '${boundary.id}'.`);
        }
        seenIds.add(boundary.id);
    }
    for (const boundary of boundaries) {
        for (const dep of boundary.deps ?? []) {
            if (!seenIds.has(dep)) {
                throw new Error(`evolution.yaml boundary '${boundary.id}' depends on unknown boundary '${dep}'.`);
            }
        }
    }
    return {
        studies,
        boundaries: boundaries.sort((left, right) => left.id.localeCompare(right.id)),
    };
}
function convertLegacyEvolution(legacy) {
    const boundaries = [];
    const studies = [];
    for (const entry of legacy.evolution_trail ?? []) {
        const delta = entry.question_delta;
        const openTexts = Array.isArray(delta?.open_boundaries)
            ? delta.open_boundaries.map((value) => String(value).trim()).filter((value) => value.length > 0)
            : [];
        const currentOpen = boundaries.filter((boundary) => boundary.state === 'open');
        const nextOpenKeys = new Set(openTexts.map((value) => normalizeTextKey(value)));
        const resolves = [];
        const opens = [];
        for (const boundary of currentOpen) {
            if (!nextOpenKeys.has(normalizeTextKey(boundary.text))) {
                boundary.state = 'resolved';
                resolves.push(boundary.id);
            }
        }
        for (const text of openTexts) {
            const existing = boundaries.find((boundary) => normalizeTextKey(boundary.text) === normalizeTextKey(text));
            if (existing) {
                existing.state = 'open';
                continue;
            }
            const newBoundary = {
                id: nextBoundaryId(boundaries),
                text,
                state: 'open',
            };
            boundaries.push(newBoundary);
            opens.push(newBoundary.id);
        }
        studies.push({
            id: String(entry.study_id ?? '').trim(),
            question: String(delta?.question_before ?? delta?.question_after ?? '').trim() || 'Unspecified study question',
            kind: (delta?.change_type ?? 'refinement'),
            resolves,
            opens,
            candidates: delta?.question_after ? [String(delta.question_after).trim()].filter((value) => value.length > 0) : [],
            ts: String(entry.timestamp ?? '').trim() || new Date().toISOString(),
        });
    }
    return {
        studies,
        boundaries: boundaries.sort((left, right) => left.id.localeCompare(right.id)),
    };
}
export function createDefaultEvolutionState() {
    return {
        studies: [],
        boundaries: [],
    };
}
export async function readEvolutionState(projectRoot) {
    const absolutePath = path.join(projectRoot, PATHS.evolution);
    if (!(await FileSystemUtils.fileExists(absolutePath))) {
        return createDefaultEvolutionState();
    }
    const raw = await readYamlFile(projectRoot, PATHS.evolution);
    if (isRecord(raw) && Array.isArray(raw.evolution_trail)) {
        return convertLegacyEvolution(raw);
    }
    return normalizeEvolutionState(raw);
}
export async function writeEvolutionState(projectRoot, state) {
    await writeYamlFile(projectRoot, PATHS.evolution, {
        studies: state.studies,
        boundaries: state.boundaries,
    });
}
export function summarizeEvolutionBoundaries(state) {
    const summary = {
        total: state.boundaries.length,
        open: 0,
        resolved: 0,
        active: [],
    };
    for (const boundary of state.boundaries) {
        if (boundary.state === 'open') {
            summary.open += 1;
            summary.active.push(boundary.id);
        }
        else {
            summary.resolved += 1;
        }
    }
    return summary;
}
export function getCurrentProjectQuestion(contract, state) {
    return state.studies.at(-1)?.question || contract.initial_question;
}
export function toBoundaryState(state) {
    return {
        boundaries: state.boundaries.map((boundary) => ({
            id: boundary.id,
            text: boundary.text,
            depends_on: boundary.deps ?? [],
            weight: boundary.weight ?? 1,
            status: boundary.state === 'resolved' ? 'resolved' : 'open',
        })),
    };
}
export function mergeBoundaryStateIntoEvolution(state, boundaryState) {
    return {
        studies: state.studies,
        boundaries: boundaryState.boundaries.map((boundary) => ({
            id: boundary.id,
            text: boundary.text,
            state: boundary.status === 'resolved' || boundary.status === 'dissolved' ? 'resolved' : 'open',
            ...(boundary.depends_on.length > 0 ? { deps: boundary.depends_on } : {}),
            ...(boundary.weight !== 1 ? { weight: boundary.weight } : {}),
        })),
    };
}
export function applyOpenBoundaryTexts(state, studyId, studyQuestion, kind, openBoundaryTexts, candidates) {
    const normalizedOpenTexts = [...new Set(openBoundaryTexts.map((value) => value.trim()).filter((value) => value.length > 0))];
    const nextState = {
        studies: [...state.studies],
        boundaries: state.boundaries.map((boundary) => ({ ...boundary, ...(boundary.deps ? { deps: [...boundary.deps] } : {}) })),
    };
    const currentOpen = nextState.boundaries.filter((boundary) => boundary.state === 'open');
    const requestedKeys = new Set(normalizedOpenTexts.map((value) => normalizeTextKey(value)));
    const resolves = [];
    const opens = [];
    for (const boundary of currentOpen) {
        if (!requestedKeys.has(normalizeTextKey(boundary.text))) {
            boundary.state = 'resolved';
            resolves.push(boundary.id);
        }
    }
    for (const text of normalizedOpenTexts) {
        const existing = nextState.boundaries.find((boundary) => normalizeTextKey(boundary.text) === normalizeTextKey(text));
        if (existing) {
            existing.state = 'open';
            continue;
        }
        const newBoundary = {
            id: nextBoundaryId(nextState.boundaries),
            text,
            state: 'open',
        };
        nextState.boundaries.push(newBoundary);
        opens.push(newBoundary.id);
    }
    nextState.boundaries.sort((left, right) => left.id.localeCompare(right.id));
    nextState.studies.push({
        id: studyId,
        question: studyQuestion,
        kind,
        resolves,
        opens,
        candidates: [...new Set(candidates.map((value) => value.trim()).filter((value) => value.length > 0))],
        ts: new Date().toISOString(),
    });
    return nextState;
}
export async function listStudyMemoryPaths(projectRoot) {
    const memoryDir = path.join(projectRoot, PATHS.contextMemoryDir);
    if (!(await FileSystemUtils.directoryExists(memoryDir))) {
        return [];
    }
    const entries = await fs.readdir(memoryDir, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && STUDY_MEMORY_PATTERN.test(entry.name))
        .map((entry) => `${PATHS.contextMemoryDir}/${entry.name}`)
        .sort((left, right) => right.localeCompare(left));
}
export async function listRecentStudyMemoryPaths(projectRoot, limit = 5) {
    return (await listStudyMemoryPaths(projectRoot)).slice(0, limit);
}
export function buildStudyMemoryMarkdown(options) {
    const openBoundaryLines = options.openBoundaryTexts.length > 0 ? options.openBoundaryTexts.map((value) => `- ${value}`).join('\n') : '- None';
    const resolvedBoundaryLines = options.resolvedBoundaryTexts.length > 0 ? options.resolvedBoundaryTexts.map((value) => `- ${value}`).join('\n') : '- None';
    const candidateLines = options.nextCandidates.length > 0 ? options.nextCandidates.map((value) => `- ${value}`).join('\n') : '- None';
    return [
        `# ${options.studyId} Memory`,
        '',
        '## Question',
        '',
        options.question,
        '',
        '## Outcome',
        '',
        `- Kind: ${options.kind}`,
        '',
        '## What Happened',
        '',
        options.changeDriver,
        '',
        '## Evidence Pointers',
        '',
        `- Study contract: studies/${options.studyId}/study.md`,
        `- Task contracts: studies/${options.studyId}/tasks/`,
        `- Study outputs: studies/${options.studyId}/output/`,
        '- Registered artifacts: artifacts/index.yaml',
        '',
        '## Resolved Boundaries',
        '',
        resolvedBoundaryLines,
        '',
        '## Open Boundaries',
        '',
        openBoundaryLines,
        '',
        '## Next Candidates',
        '',
        candidateLines,
        '',
        '## Reflection',
        '',
        '- Keep only durable lessons here; do not turn this file into a raw execution log.',
        '- If a stable resource, dataset, or method preference should carry across studies, also update context/resources.md explicitly.',
        '',
    ].join('\n');
}
export async function writeStudyMemory(projectRoot, studyId, markdown) {
    const relativePath = `${PATHS.contextMemoryDir}/${studyId}.md`;
    await FileSystemUtils.writeFile(path.join(projectRoot, relativePath), markdown);
    return relativePath;
}
function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
export async function renderResearchMapHtml(projectRoot, outputPath = PATHS.researchMapHtml) {
    const state = await readEvolutionState(projectRoot);
    const summary = summarizeEvolutionBoundaries(state);
    const relativeOutputPath = path.isAbsolute(outputPath) ? path.relative(projectRoot, outputPath).split(path.sep).join('/') : outputPath;
    const absoluteOutputPath = path.join(projectRoot, relativeOutputPath);
    const studyRows = state.studies
        .map((study) => `
        <tr>
          <td>${escapeHtml(study.id)}</td>
          <td>${escapeHtml(study.kind)}</td>
          <td>${escapeHtml(study.question)}</td>
          <td>${escapeHtml(study.resolves.join(', ') || '-')}</td>
          <td>${escapeHtml(study.opens.join(', ') || '-')}</td>
          <td>${escapeHtml(study.candidates.join(' | ') || '-')}</td>
        </tr>`)
        .join('\n');
    const boundaryRows = state.boundaries
        .map((boundary) => `
        <tr>
          <td>${escapeHtml(boundary.id)}</td>
          <td>${escapeHtml(boundary.state)}</td>
          <td>${escapeHtml((boundary.deps ?? []).join(', ') || '-')}</td>
          <td>${escapeHtml(boundary.text)}</td>
        </tr>`)
        .join('\n');
    const studyNodes = state.studies.map((study, index) => ({
        id: study.id,
        label: study.id,
        type: 'study',
        x: 120 + index * 180,
        y: 70,
    }));
    const boundaryNodes = state.boundaries.map((boundary, index) => ({
        id: boundary.id,
        label: boundary.id,
        type: 'boundary',
        state: boundary.state,
        x: 120 + (index % 5) * 150,
        y: 220 + Math.floor(index / 5) * 110,
    }));
    const edges = [
        ...state.studies.flatMap((study) => study.resolves.map((boundaryId) => ({ from: study.id, to: boundaryId, kind: 'resolves' }))),
        ...state.studies.flatMap((study) => study.opens.map((boundaryId) => ({ from: study.id, to: boundaryId, kind: 'opens' }))),
        ...state.boundaries.flatMap((boundary) => (boundary.deps ?? []).map((dependencyId) => ({ from: dependencyId, to: boundary.id, kind: 'depends' }))),
    ];
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>QDD Research Map</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f7fb;
        --panel: #ffffff;
        --text: #172033;
        --muted: #5c667a;
        --border: #d9e0ec;
        --study: #2563eb;
        --open: #f59e0b;
        --resolved: #16a34a;
      }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: var(--bg); color: var(--text); }
      main { max-width: 1440px; margin: 0 auto; padding: 24px; }
      h1, h2 { margin: 0 0 12px; }
      p { margin: 0; color: var(--muted); }
      .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
      .metric, .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 14px; }
      .metric strong { display: block; font-size: 24px; }
      .grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-top: 16px; }
      .stack { display: grid; gap: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 8px 10px; border-top: 1px solid var(--border); vertical-align: top; font-size: 14px; }
      th { color: var(--muted); font-weight: 600; }
      svg { width: 100%; height: 520px; border: 1px solid var(--border); border-radius: 8px; background: #fbfcff; }
      .legend { display: flex; gap: 12px; font-size: 13px; color: var(--muted); margin-bottom: 12px; flex-wrap: wrap; }
      .dot { display: inline-block; width: 10px; height: 10px; border-radius: 999px; margin-right: 6px; }
      @media (max-width: 1000px) {
        .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>QDD Research Map</h1>
      <p>One derived view of study evolution and current project boundaries.</p>

      <section class="metrics">
        <div class="metric"><span>Studies</span><strong>${state.studies.length}</strong></div>
        <div class="metric"><span>Boundaries</span><strong>${summary.total}</strong></div>
        <div class="metric"><span>Open</span><strong>${summary.open}</strong></div>
        <div class="metric"><span>Resolved</span><strong>${summary.resolved}</strong></div>
      </section>

      <section class="grid">
        <div class="panel">
          <h2>Graph View</h2>
          <div class="legend">
            <span><span class="dot" style="background: var(--study)"></span>study</span>
            <span><span class="dot" style="background: var(--open)"></span>open boundary</span>
            <span><span class="dot" style="background: var(--resolved)"></span>resolved boundary</span>
          </div>
          <svg id="research-map" viewBox="0 0 1100 520" role="img" aria-label="QDD research map"></svg>
        </div>
        <div class="stack">
          <div class="panel">
            <h2>Study Timeline</h2>
            <table>
              <thead>
                <tr><th>Study</th><th>Kind</th><th>Question</th><th>Resolves</th><th>Opens</th><th>Next Candidates</th></tr>
              </thead>
              <tbody>${studyRows || '<tr><td colspan="6">No studies closed yet.</td></tr>'}</tbody>
            </table>
          </div>
          <div class="panel">
            <h2>Boundary Map</h2>
            <table>
              <thead>
                <tr><th>ID</th><th>State</th><th>Depends On</th><th>Text</th></tr>
              </thead>
              <tbody>${boundaryRows || '<tr><td colspan="4">No project boundaries recorded yet.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
    <script>
      const studyNodes = ${JSON.stringify(studyNodes)};
      const boundaryNodes = ${JSON.stringify(boundaryNodes)};
      const edges = ${JSON.stringify(edges)};
      const svg = document.getElementById('research-map');
      const positions = new Map();
      const allNodes = [...studyNodes, ...boundaryNodes];
      allNodes.forEach((node) => positions.set(node.id, node));

      function draw(tag, attrs) {
        const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
        svg.appendChild(node);
        return node;
      }

      edges.forEach((edge) => {
        const from = positions.get(edge.from);
        const to = positions.get(edge.to);
        if (!from || !to) return;
        const stroke = edge.kind === 'depends' ? '#94a3b8' : edge.kind === 'resolves' ? '#16a34a' : '#f59e0b';
        const dash = edge.kind === 'depends' ? '6 4' : '';
        draw('line', {
          x1: from.x,
          y1: from.y + (from.type === 'study' ? 18 : 0),
          x2: to.x,
          y2: to.y - (to.type === 'study' ? 18 : 0),
          stroke,
          'stroke-width': 2,
          ...(dash ? { 'stroke-dasharray': dash } : {}),
        });
      });

      studyNodes.forEach((node) => {
        draw('rect', {
          x: node.x - 48,
          y: node.y - 18,
          width: 96,
          height: 36,
          rx: 8,
          fill: '#2563eb',
        });
        const label = draw('text', {
          x: node.x,
          y: node.y + 5,
          'text-anchor': 'middle',
          'font-size': 12,
          'font-family': 'Inter, sans-serif',
          fill: '#ffffff',
        });
        label.textContent = node.label;
      });

      boundaryNodes.forEach((node) => {
        draw('circle', {
          cx: node.x,
          cy: node.y,
          r: 22,
          fill: node.state === 'resolved' ? '#16a34a' : '#f59e0b',
        });
        const label = draw('text', {
          x: node.x,
          y: node.y + 4,
          'text-anchor': 'middle',
          'font-size': 11,
          'font-family': 'Inter, sans-serif',
          fill: '#ffffff',
        });
        label.textContent = node.label;
      });
    </script>
  </body>
</html>`;
    await FileSystemUtils.createDirectory(path.dirname(absoluteOutputPath));
    await fs.writeFile(absoluteOutputPath, html, 'utf-8');
    return relativeOutputPath;
}
//# sourceMappingURL=evolution.js.map