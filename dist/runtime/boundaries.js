import path from 'node:path';
import * as fs from 'node:fs/promises';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
import { createDefaultBoundaryState } from './defaults.js';
import { discoverStudies } from './discovery.js';
import { getStudyBoundaryUpdatesPath } from './evidence.js';
import { readMarkdownFrontmatter, readYamlFile, writeYamlFile } from './store.js';
const BOUNDARY_ID_PATTERN = /^B\d{3}$/;
function normalizeProjectRelativePath(projectRoot, targetPath) {
    const normalizedPath = path.isAbsolute(targetPath) ? path.relative(projectRoot, targetPath) : targetPath;
    const slashPath = normalizedPath.split(path.sep).join('/');
    if (slashPath.startsWith('../') || slashPath === '..' || path.isAbsolute(slashPath)) {
        throw new Error(`Path '${targetPath}' must stay within the current QDD project.`);
    }
    return slashPath;
}
function isBoundaryStatus(value) {
    return ['open', 'narrowed', 'resolved', 'dissolved'].includes(value);
}
function isActiveBoundary(boundary) {
    return boundary.status === 'open' || boundary.status === 'narrowed';
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function normalizeBoundaryRecord(raw, sourcePath, index) {
    if (!isRecord(raw)) {
        throw new Error(`${sourcePath}#${index} must be an object.`);
    }
    const id = String(raw.id ?? '').trim();
    if (!BOUNDARY_ID_PATTERN.test(id)) {
        throw new Error(`${sourcePath}#${index} has invalid id '${id || 'undefined'}'. Expected BXXX.`);
    }
    const text = String(raw.text ?? '').trim();
    if (!text) {
        throw new Error(`${sourcePath}#${index} is missing a non-empty text.`);
    }
    const dependsOn = Array.isArray(raw.depends_on)
        ? raw.depends_on.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0)
        : [];
    for (const dependencyId of dependsOn) {
        if (!BOUNDARY_ID_PATTERN.test(dependencyId)) {
            throw new Error(`${sourcePath}#${index} has invalid depends_on boundary id '${dependencyId}'. Expected BXXX.`);
        }
    }
    const rawWeight = Number(raw.weight);
    if (!Number.isFinite(rawWeight) || rawWeight < 0) {
        throw new Error(`${sourcePath}#${index} has invalid weight '${String(raw.weight ?? '')}'. Weight must be a non-negative number.`);
    }
    const status = String(raw.status ?? '').trim();
    if (!isBoundaryStatus(status)) {
        throw new Error(`${sourcePath}#${index} has invalid status '${status || 'undefined'}'.`);
    }
    return {
        id,
        text,
        depends_on: dependsOn,
        weight: rawWeight,
        status,
    };
}
export async function readBoundaryState(projectRoot) {
    const absolutePath = path.join(projectRoot, PATHS.boundaries);
    if (!(await FileSystemUtils.fileExists(absolutePath))) {
        return createDefaultBoundaryState();
    }
    const state = await readYamlFile(projectRoot, PATHS.boundaries);
    if (!Array.isArray(state.boundaries)) {
        throw new Error(`${PATHS.boundaries} must define a boundaries array.`);
    }
    const boundaries = state.boundaries.map((entry, index) => normalizeBoundaryRecord(entry, PATHS.boundaries, index));
    validateBoundaryGraph(boundaries, PATHS.boundaries);
    return { boundaries };
}
export async function writeBoundaryState(projectRoot, state) {
    validateBoundaryGraph(state.boundaries, PATHS.boundaries);
    await writeYamlFile(projectRoot, PATHS.boundaries, state);
}
function validateBoundaryGraph(boundaries, sourcePath) {
    const ids = new Set();
    for (const boundary of boundaries) {
        if (ids.has(boundary.id)) {
            throw new Error(`${sourcePath} contains duplicate boundary id '${boundary.id}'.`);
        }
        ids.add(boundary.id);
    }
    for (const boundary of boundaries) {
        for (const dependencyId of boundary.depends_on) {
            if (!ids.has(dependencyId)) {
                throw new Error(`${sourcePath} boundary '${boundary.id}' depends on missing boundary '${dependencyId}'.`);
            }
            if (dependencyId === boundary.id) {
                throw new Error(`${sourcePath} boundary '${boundary.id}' cannot depend on itself.`);
            }
        }
    }
}
function normalizeUpdateEntry(raw, sourcePath, index) {
    if (!isRecord(raw)) {
        throw new Error(`${sourcePath}#${index} must be an object.`);
    }
    const rawAction = String(raw.action ?? '').trim();
    if (!['add', 'narrow', 'resolve', 'dissolve'].includes(rawAction)) {
        throw new Error(`${sourcePath}#${index} has invalid action '${rawAction || 'undefined'}'.`);
    }
    const action = rawAction;
    if (action === 'add') {
        if (!isRecord(raw.boundary)) {
            throw new Error(`${sourcePath}#${index} action add must include a boundary object.`);
        }
        return {
            action: 'add',
            boundary: normalizeBoundaryRecord(raw.boundary, `${sourcePath}#${index}.boundary`, 0),
        };
    }
    const id = String(raw.id ?? '').trim();
    if (!BOUNDARY_ID_PATTERN.test(id)) {
        throw new Error(`${sourcePath}#${index} has invalid id '${id || 'undefined'}'. Expected BXXX.`);
    }
    if (action === 'narrow') {
        const text = raw.text === undefined ? undefined : String(raw.text ?? '').trim();
        const dependsOn = Array.isArray(raw.depends_on)
            ? raw.depends_on.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0)
            : undefined;
        const weight = raw.weight === undefined ? undefined : Number(raw.weight);
        if (text !== undefined && !text) {
            throw new Error(`${sourcePath}#${index} narrow update text must not be empty.`);
        }
        if (dependsOn) {
            for (const dependencyId of dependsOn) {
                if (!BOUNDARY_ID_PATTERN.test(dependencyId)) {
                    throw new Error(`${sourcePath}#${index} has invalid depends_on boundary id '${dependencyId}'. Expected BXXX.`);
                }
            }
        }
        if (weight !== undefined && (!Number.isFinite(weight) || weight < 0)) {
            throw new Error(`${sourcePath}#${index} has invalid weight '${String(raw.weight ?? '')}'. Weight must be a non-negative number.`);
        }
        return {
            action: 'narrow',
            id,
            text,
            depends_on: dependsOn,
            weight,
        };
    }
    return {
        action,
        id,
    };
}
export async function readBoundaryUpdateManifest(projectRoot, relativePath) {
    const absolutePath = path.isAbsolute(relativePath) ? relativePath : path.join(projectRoot, relativePath);
    if (!(await FileSystemUtils.fileExists(absolutePath))) {
        throw new Error(`Boundary update file '${relativePath}' does not exist.`);
    }
    const projectRelativePath = normalizeProjectRelativePath(projectRoot, absolutePath);
    const manifest = await readYamlFile(projectRoot, absolutePath);
    if (!Array.isArray(manifest.updates)) {
        throw new Error(`${projectRelativePath} must define an updates array.`);
    }
    return {
        updates: manifest.updates.map((entry, index) => normalizeUpdateEntry(entry, projectRelativePath, index)),
    };
}
export async function applyBoundaryUpdates(projectRoot, relativePath) {
    const currentState = await readBoundaryState(projectRoot);
    const manifest = await readBoundaryUpdateManifest(projectRoot, normalizeProjectRelativePath(projectRoot, relativePath));
    const nextBoundaries = new Map(currentState.boundaries.map((boundary) => [boundary.id, { ...boundary }]));
    const updateSummary = [];
    for (const update of manifest.updates) {
        if (update.action === 'add') {
            if (nextBoundaries.has(update.boundary.id)) {
                throw new Error(`Boundary '${update.boundary.id}' already exists and cannot be added twice.`);
            }
            nextBoundaries.set(update.boundary.id, { ...update.boundary });
            updateSummary.push({
                boundary_id: update.boundary.id,
                action: 'add',
            });
            continue;
        }
        const existing = nextBoundaries.get(update.id);
        if (!existing) {
            throw new Error(`Boundary '${update.id}' does not exist and cannot be updated.`);
        }
        if (update.action === 'narrow') {
            nextBoundaries.set(update.id, {
                ...existing,
                text: update.text ?? existing.text,
                depends_on: update.depends_on ?? existing.depends_on,
                weight: update.weight ?? existing.weight,
                status: 'narrowed',
            });
            updateSummary.push({
                boundary_id: update.id,
                action: 'narrow',
            });
            continue;
        }
        nextBoundaries.set(update.id, {
            ...existing,
            status: update.action === 'resolve' ? 'resolved' : 'dissolved',
        });
        updateSummary.push({
            boundary_id: update.id,
            action: update.action,
        });
    }
    const state = {
        boundaries: [...nextBoundaries.values()].sort((left, right) => left.id.localeCompare(right.id)),
    };
    validateBoundaryGraph(state.boundaries, PATHS.boundaries);
    await writeBoundaryState(projectRoot, state);
    return {
        state,
        updates: updateSummary,
    };
}
export function summarizeBoundaryState(state) {
    const summary = {
        total: state.boundaries.length,
        open: 0,
        narrowed: 0,
        resolved: 0,
        dissolved: 0,
        active: [],
    };
    for (const boundary of state.boundaries) {
        if (boundary.status === 'open')
            summary.open += 1;
        if (boundary.status === 'narrowed')
            summary.narrowed += 1;
        if (boundary.status === 'resolved')
            summary.resolved += 1;
        if (boundary.status === 'dissolved')
            summary.dissolved += 1;
        if (boundary.status === 'open' || boundary.status === 'narrowed') {
            summary.active.push(boundary.id);
        }
    }
    return summary;
}
function uniqueSortedValues(values) {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
function requireKnownBoundaryIds(boundariesById, targetIds) {
    for (const targetId of targetIds) {
        if (!BOUNDARY_ID_PATTERN.test(targetId)) {
            throw new Error(`Invalid boundary id '${targetId}'. Expected BXXX.`);
        }
        if (!boundariesById.has(targetId)) {
            throw new Error(`Unknown project boundary '${targetId}'.`);
        }
    }
}
function collectActiveAncestors(boundariesById, boundaryId, seen = new Set()) {
    if (seen.has(boundaryId)) {
        return seen;
    }
    seen.add(boundaryId);
    const boundary = boundariesById.get(boundaryId);
    if (!boundary) {
        return seen;
    }
    for (const dependencyId of boundary.depends_on) {
        const dependency = boundariesById.get(dependencyId);
        if (dependency && isActiveBoundary(dependency)) {
            collectActiveAncestors(boundariesById, dependencyId, seen);
        }
    }
    return seen;
}
function collectReachableActiveDescendants(boundariesById, startIds) {
    const reachable = new Set();
    const queue = [...startIds];
    while (queue.length > 0) {
        const currentId = queue.shift();
        if (reachable.has(currentId)) {
            continue;
        }
        const current = boundariesById.get(currentId);
        if (!current || !isActiveBoundary(current)) {
            continue;
        }
        reachable.add(currentId);
        for (const candidate of boundariesById.values()) {
            if (!isActiveBoundary(candidate)) {
                continue;
            }
            if (candidate.depends_on.includes(currentId)) {
                queue.push(candidate.id);
            }
        }
    }
    return reachable;
}
function sumBoundaryMass(boundariesById, boundaryIds) {
    return boundaryIds.reduce((total, boundaryId) => total + (boundariesById.get(boundaryId)?.weight ?? 0), 0);
}
export function scoreBoundaryTargets(state, requestedTargetIds, mode) {
    const targetIds = uniqueSortedValues(requestedTargetIds.map((value) => value.trim()).filter((value) => value.length > 0));
    if (targetIds.length === 0) {
        throw new Error('Boundary score requires at least one target boundary.');
    }
    const boundariesById = new Map(state.boundaries.map((boundary) => [boundary.id, boundary]));
    requireKnownBoundaryIds(boundariesById, targetIds);
    const activeProjectIds = state.boundaries.filter((boundary) => isActiveBoundary(boundary)).map((boundary) => boundary.id);
    const activeProjectMass = sumBoundaryMass(boundariesById, activeProjectIds);
    const inactiveTargets = targetIds.filter((targetId) => !isActiveBoundary(boundariesById.get(targetId)));
    const closureSet = new Set();
    const missingAncestorSet = new Set();
    for (const targetId of targetIds) {
        const target = boundariesById.get(targetId);
        if (!isActiveBoundary(target)) {
            continue;
        }
        const activeAncestors = collectActiveAncestors(boundariesById, targetId);
        for (const ancestorId of activeAncestors) {
            closureSet.add(ancestorId);
            if (ancestorId !== targetId && !targetIds.includes(ancestorId)) {
                missingAncestorSet.add(ancestorId);
            }
        }
    }
    const closure = uniqueSortedValues([...closureSet]);
    const frontier = closure.filter((boundaryId) => {
        const boundary = boundariesById.get(boundaryId);
        return !boundary.depends_on.some((dependencyId) => closureSet.has(dependencyId) && isActiveBoundary(boundariesById.get(dependencyId)));
    });
    const closureMass = sumBoundaryMass(boundariesById, closure);
    const frontierMass = sumBoundaryMass(boundariesById, frontier);
    const reachableActiveIds = uniqueSortedValues([...collectReachableActiveDescendants(boundariesById, frontier)]);
    const reachableActiveMass = sumBoundaryMass(boundariesById, reachableActiveIds);
    const legal = inactiveTargets.length === 0 && missingAncestorSet.size === 0;
    const notes = [];
    if (inactiveTargets.length > 0) {
        notes.push('inactive-targets');
    }
    if (missingAncestorSet.size > 0) {
        notes.push('needs-frontier-downshift');
    }
    if (frontier.length > 1) {
        notes.push('wide-frontier');
    }
    return {
        mode,
        target_boundaries: targetIds,
        legal,
        missing_active_ancestors: uniqueSortedValues([...missingAncestorSet]),
        suggested_frontier: frontier,
        closure,
        frontier,
        closure_size: closure.length,
        frontier_size: frontier.length,
        closure_mass: closureMass,
        frontier_mass: frontierMass,
        reachable_active_mass: reachableActiveMass,
        active_project_mass: activeProjectMass,
        quality_score: closureMass === 0 ? 0 : Number((frontierMass / closureMass).toFixed(4)),
        priority_score: activeProjectMass === 0 ? 0 : Number((reachableActiveMass / activeProjectMass).toFixed(4)),
        notes,
    };
}
export async function scoreStudyBoundaries(projectRoot, studyId) {
    const state = await readBoundaryState(projectRoot);
    const record = await readMarkdownFrontmatter(projectRoot, `${PATHS.studiesDir}/${studyId}/study.md`);
    const targetBoundaries = Array.isArray(record.target_boundaries) ? record.target_boundaries : [];
    if (targetBoundaries.length === 0) {
        throw new Error(`Study '${studyId}' has no declared target_boundaries to score.`);
    }
    return scoreBoundaryTargets(state, targetBoundaries, 'study');
}
async function readStudyTargetBoundaries(projectRoot) {
    const studies = await discoverStudies(projectRoot);
    return Promise.all(studies.map(async (study) => {
        const record = await readMarkdownFrontmatter(projectRoot, `${PATHS.studiesDir}/${study.study_id}/study.md`);
        return {
            study_id: study.study_id,
            target_boundaries: record.target_boundaries ?? [],
        };
    }));
}
function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
export async function renderBoundaryGraphHtml(projectRoot, outputPath = PATHS.boundaryGraphHtml) {
    const [state, targets] = await Promise.all([readBoundaryState(projectRoot), readStudyTargetBoundaries(projectRoot)]);
    const studies = await discoverStudies(projectRoot);
    const updatesByStudy = await Promise.all(studies.map(async (study) => {
        const relativePath = getStudyBoundaryUpdatesPath(study.study_id);
        const absolutePath = path.join(projectRoot, relativePath);
        if (!(await FileSystemUtils.fileExists(absolutePath))) {
            return {
                study_id: study.study_id,
                updates: [],
            };
        }
        const manifest = await readBoundaryUpdateManifest(projectRoot, relativePath);
        return {
            study_id: study.study_id,
            updates: manifest.updates.map((update) => ({
                boundary_id: update.action === 'add' ? update.boundary.id : update.id,
                action: update.action,
            })),
        };
    }));
    const summary = summarizeBoundaryState(state);
    const relativeOutputPath = normalizeProjectRelativePath(projectRoot, path.isAbsolute(outputPath) ? outputPath : path.join(projectRoot, outputPath));
    const absoluteOutputPath = path.join(projectRoot, relativeOutputPath);
    const boundaryRows = state.boundaries
        .map((boundary) => `
        <tr>
          <td>${escapeHtml(boundary.id)}</td>
          <td>${escapeHtml(boundary.status)}</td>
          <td>${escapeHtml(String(boundary.weight))}</td>
          <td>${escapeHtml(boundary.depends_on.join(', ') || '-')}</td>
          <td>${escapeHtml(boundary.text)}</td>
        </tr>`)
        .join('\n');
    const targetRows = targets
        .filter((entry) => entry.target_boundaries.length > 0)
        .map((entry) => `
        <tr>
          <td>${escapeHtml(entry.study_id)}</td>
          <td>${escapeHtml(entry.target_boundaries.join(', '))}</td>
        </tr>`)
        .join('\n');
    const updateRows = updatesByStudy
        .flatMap((entry) => entry.updates.map((update) => `
          <tr>
            <td>${escapeHtml(entry.study_id)}</td>
            <td>${escapeHtml(update.boundary_id)}</td>
            <td>${escapeHtml(update.action)}</td>
          </tr>`))
        .join('\n');
    const edgePayload = state.boundaries.flatMap((boundary) => boundary.depends_on.map((dependencyId) => ({
        from: dependencyId,
        to: boundary.id,
    })));
    const nodePayload = state.boundaries.map((boundary) => ({
        id: boundary.id,
        label: boundary.id,
        status: boundary.status,
    }));
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>QDD Boundary Graph</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f7fb;
        --panel: #ffffff;
        --text: #172033;
        --muted: #5c667a;
        --border: #d9e0ec;
        --open: #1d4ed8;
        --narrowed: #7c3aed;
        --resolved: #15803d;
        --dissolved: #b45309;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: var(--bg);
        color: var(--text);
      }
      main {
        max-width: 1400px;
        margin: 0 auto;
        padding: 24px;
      }
      h1, h2 { margin: 0 0 12px; }
      p { margin: 0; color: var(--muted); }
      .grid {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 16px;
        margin-top: 16px;
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 16px;
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 12px;
        margin-top: 16px;
      }
      .metric {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px;
      }
      .metric strong {
        display: block;
        font-size: 24px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        text-align: left;
        padding: 8px 10px;
        border-top: 1px solid var(--border);
        vertical-align: top;
        font-size: 14px;
      }
      th {
        color: var(--muted);
        font-weight: 600;
      }
      .legend {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 12px;
        color: var(--muted);
        font-size: 13px;
      }
      .dot {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 999px;
        margin-right: 6px;
      }
      .graph-wrap {
        min-height: 420px;
      }
      svg {
        width: 100%;
        height: 420px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: #fbfcff;
      }
      .section-stack {
        display: grid;
        gap: 16px;
      }
      .small-note {
        margin-top: 8px;
        font-size: 12px;
        color: var(--muted);
      }
      @media (max-width: 1000px) {
        .grid { grid-template-columns: 1fr; }
        .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>QDD Boundary Graph</h1>
      <p>Project-level question state, study targeting, and closure-time boundary updates.</p>

      <section class="metrics">
        <div class="metric"><span>Total</span><strong>${summary.total}</strong></div>
        <div class="metric"><span>Open</span><strong>${summary.open}</strong></div>
        <div class="metric"><span>Narrowed</span><strong>${summary.narrowed}</strong></div>
        <div class="metric"><span>Resolved</span><strong>${summary.resolved}</strong></div>
        <div class="metric"><span>Dissolved</span><strong>${summary.dissolved}</strong></div>
      </section>

      <section class="grid">
        <div class="panel graph-wrap">
          <h2>Dependency View</h2>
          <div class="legend">
            <span><span class="dot" style="background: var(--open)"></span>open</span>
            <span><span class="dot" style="background: var(--narrowed)"></span>narrowed</span>
            <span><span class="dot" style="background: var(--resolved)"></span>resolved</span>
            <span><span class="dot" style="background: var(--dissolved)"></span>dissolved</span>
          </div>
          <svg id="boundary-graph" viewBox="0 0 900 420" role="img" aria-label="Boundary dependency graph"></svg>
          <p class="small-note">Edge direction: upstream dependency -> downstream boundary.</p>
        </div>
        <div class="section-stack">
          <div class="panel">
            <h2>Current Boundaries</h2>
            <table>
              <thead>
                <tr><th>ID</th><th>Status</th><th>Weight</th><th>Depends On</th><th>Description</th></tr>
              </thead>
              <tbody>${boundaryRows}</tbody>
            </table>
          </div>
          <div class="panel">
            <h2>Study Targeting</h2>
            <table>
              <thead>
                <tr><th>Study</th><th>Target Boundaries</th></tr>
              </thead>
              <tbody>${targetRows || '<tr><td colspan="2">No study target_boundaries recorded yet.</td></tr>'}</tbody>
            </table>
          </div>
          <div class="panel">
            <h2>Closure Updates</h2>
            <table>
              <thead>
                <tr><th>Study</th><th>Boundary</th><th>Action</th></tr>
              </thead>
              <tbody>${updateRows || '<tr><td colspan="3">No boundary updates recorded yet.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
    <script>
      const nodes = ${JSON.stringify(nodePayload)};
      const edges = ${JSON.stringify(edgePayload)};
      const colors = {
        open: '#1d4ed8',
        narrowed: '#7c3aed',
        resolved: '#15803d',
        dissolved: '#b45309',
      };

      const svg = document.getElementById('boundary-graph');
      const width = 900;
      const height = 420;
      const levels = new Map();

      function computeLevel(id, stack = new Set()) {
        if (levels.has(id)) return levels.get(id);
        if (stack.has(id)) return 0;
        stack.add(id);
        const incoming = edges.filter((edge) => edge.to === id).map((edge) => edge.from);
        const level = incoming.length === 0 ? 0 : Math.max(...incoming.map((source) => computeLevel(source, stack))) + 1;
        stack.delete(id);
        levels.set(id, level);
        return level;
      }

      nodes.forEach((node) => computeLevel(node.id));
      const byLevel = new Map();
      nodes.forEach((node) => {
        const level = levels.get(node.id) || 0;
        if (!byLevel.has(level)) byLevel.set(level, []);
        byLevel.get(level).push(node);
      });

      const positioned = new Map();
      const sortedLevels = [...byLevel.keys()].sort((a, b) => a - b);
      sortedLevels.forEach((level, levelIndex) => {
        const column = byLevel.get(level);
        column.sort((left, right) => left.id.localeCompare(right.id));
        column.forEach((node, index) => {
          const x = 100 + levelIndex * ((width - 200) / Math.max(1, sortedLevels.length - 1 || 1));
          const y = 70 + index * ((height - 140) / Math.max(1, column.length - 1 || 1));
          positioned.set(node.id, { ...node, x, y });
        });
      });

      function draw(tag, attrs) {
        const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
        svg.appendChild(node);
        return node;
      }

      edges.forEach((edge) => {
        const from = positioned.get(edge.from);
        const to = positioned.get(edge.to);
        if (!from || !to) return;
        draw('line', {
          x1: from.x + 18,
          y1: from.y,
          x2: to.x - 18,
          y2: to.y,
          stroke: '#94a3b8',
          'stroke-width': 2,
        });
      });

      nodes.forEach((node) => {
        const point = positioned.get(node.id);
        if (!point) return;
        draw('circle', {
          cx: point.x,
          cy: point.y,
          r: 18,
          fill: colors[node.status] || '#64748b',
        });
        const label = draw('text', {
          x: point.x,
          y: point.y + 4,
          'text-anchor': 'middle',
          'font-size': 11,
          'font-family': 'Inter, sans-serif',
          fill: '#ffffff',
        });
        label.textContent = node.id;
        const status = draw('text', {
          x: point.x,
          y: point.y + 34,
          'text-anchor': 'middle',
          'font-size': 11,
          'font-family': 'Inter, sans-serif',
          fill: '#475569',
        });
        status.textContent = node.status;
      });
    </script>
  </body>
</html>`;
    await FileSystemUtils.createDirectory(path.dirname(absoluteOutputPath));
    await fs.writeFile(absoluteOutputPath, html, 'utf-8');
    return relativeOutputPath;
}
//# sourceMappingURL=boundaries.js.map