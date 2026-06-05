import path from 'node:path';
import type {
  BoundaryRecord,
  BoundaryScoreJson,
  BoundaryState,
  BoundaryStatus,
  BoundaryUpdateEntry,
  BoundaryUpdateManifest,
  BoundaryUpdateSummaryEntry,
  StudyRecord,
} from '../types.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from '../runtime/constants.js';
import {
  mergeBoundaryStateIntoEvolution,
  readEvolutionState,
  renderResearchMapHtml,
  toBoundaryState,
  writeEvolutionState,
} from '../runtime/evolution.js';
import { readMarkdownFrontmatter, readYamlFile } from '../runtime/store.js';

const BOUNDARY_ID_PATTERN = /^B\d{3}$/;

function normalizeProjectRelativePath(projectRoot: string, targetPath: string): string {
  const normalizedPath = path.isAbsolute(targetPath) ? path.relative(projectRoot, targetPath) : targetPath;
  const slashPath = normalizedPath.split(path.sep).join('/');

  if (slashPath.startsWith('../') || slashPath === '..' || path.isAbsolute(slashPath)) {
    throw new Error(`Path '${targetPath}' must stay within the current QDD project.`);
  }

  return slashPath;
}

function isBoundaryStatus(value: string): value is BoundaryStatus {
  return ['open', 'narrowed', 'resolved', 'dissolved'].includes(value);
}

function isActiveBoundary(boundary: Pick<BoundaryRecord, 'status'>): boolean {
  return boundary.status === 'open' || boundary.status === 'narrowed';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeBoundaryRecord(raw: unknown, sourcePath: string, index: number): BoundaryRecord {
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

  const rawWeight = raw.weight === undefined ? 1 : Number(raw.weight);
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

function validateBoundaryGraph(boundaries: BoundaryRecord[], sourcePath: string): void {
  const ids = new Set<string>();

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

export async function readBoundaryState(projectRoot: string): Promise<BoundaryState> {
  const evolution = await readEvolutionState(projectRoot);
  return toBoundaryState(evolution);
}

export async function writeBoundaryState(projectRoot: string, state: BoundaryState): Promise<void> {
  validateBoundaryGraph(state.boundaries, 'boundary-state');
  const evolution = await readEvolutionState(projectRoot);
  await writeEvolutionState(projectRoot, mergeBoundaryStateIntoEvolution(evolution, state));
}

function normalizeUpdateEntry(raw: unknown, sourcePath: string, index: number): BoundaryUpdateEntry {
  if (!isRecord(raw)) {
    throw new Error(`${sourcePath}#${index} must be an object.`);
  }

  const rawAction = String(raw.action ?? '').trim();
  if (!['add', 'narrow', 'resolve', 'dissolve'].includes(rawAction)) {
    throw new Error(`${sourcePath}#${index} has invalid action '${rawAction || 'undefined'}'.`);
  }

  const action = rawAction as BoundaryUpdateEntry['action'];
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

  return { action, id };
}

export async function readBoundaryUpdateManifest(projectRoot: string, relativePath: string): Promise<BoundaryUpdateManifest> {
  const absolutePath = path.isAbsolute(relativePath) ? relativePath : path.join(projectRoot, relativePath);
  if (!(await FileSystemUtils.fileExists(absolutePath))) {
    throw new Error(`Boundary update file '${relativePath}' does not exist.`);
  }

  const projectRelativePath = normalizeProjectRelativePath(projectRoot, absolutePath);
  const manifest = await readYamlFile<BoundaryUpdateManifest>(projectRoot, absolutePath);
  if (!Array.isArray(manifest.updates)) {
    throw new Error(`${projectRelativePath} must define an updates array.`);
  }

  return {
    updates: manifest.updates.map((entry, index) => normalizeUpdateEntry(entry, projectRelativePath, index)),
  };
}

export async function applyBoundaryUpdates(projectRoot: string, relativePath: string): Promise<{ state: BoundaryState; updates: BoundaryUpdateSummaryEntry[] }> {
  const currentState = await readBoundaryState(projectRoot);
  const manifest = await readBoundaryUpdateManifest(projectRoot, normalizeProjectRelativePath(projectRoot, relativePath));
  const nextBoundaries = new Map(currentState.boundaries.map((boundary) => [boundary.id, { ...boundary }]));
  const updateSummary: BoundaryUpdateSummaryEntry[] = [];

  for (const update of manifest.updates) {
    if (update.action === 'add') {
      if (nextBoundaries.has(update.boundary.id)) {
        throw new Error(`Boundary '${update.boundary.id}' already exists and cannot be added twice.`);
      }
      nextBoundaries.set(update.boundary.id, { ...update.boundary });
      updateSummary.push({ boundary_id: update.boundary.id, action: 'add' });
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
      updateSummary.push({ boundary_id: update.id, action: 'narrow' });
      continue;
    }

    nextBoundaries.set(update.id, {
      ...existing,
      status: update.action === 'resolve' ? 'resolved' : 'dissolved',
    });
    updateSummary.push({ boundary_id: update.id, action: update.action });
  }

  const nextState: BoundaryState = {
    boundaries: [...nextBoundaries.values()].sort((left, right) => left.id.localeCompare(right.id)),
  };

  validateBoundaryGraph(nextState.boundaries, 'boundary-update-manifest');
  await writeBoundaryState(projectRoot, nextState);
  return { state: nextState, updates: updateSummary };
}

export function summarizeBoundaryState(state: BoundaryState): {
  total: number;
  open: number;
  narrowed: number;
  resolved: number;
  dissolved: number;
  active: string[];
} {
  const summary = {
    total: state.boundaries.length,
    open: 0,
    narrowed: 0,
    resolved: 0,
    dissolved: 0,
    active: [] as string[],
  };

  for (const boundary of state.boundaries) {
    if (boundary.status === 'open') summary.open += 1;
    if (boundary.status === 'narrowed') summary.narrowed += 1;
    if (boundary.status === 'resolved') summary.resolved += 1;
    if (boundary.status === 'dissolved') summary.dissolved += 1;
    if (boundary.status === 'open' || boundary.status === 'narrowed') {
      summary.active.push(boundary.id);
    }
  }

  return summary;
}

function uniqueSortedValues(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function requireKnownBoundaryIds(boundariesById: Map<string, BoundaryRecord>, targetIds: string[]): void {
  for (const targetId of targetIds) {
    if (!BOUNDARY_ID_PATTERN.test(targetId)) {
      throw new Error(`Invalid boundary id '${targetId}'. Expected BXXX.`);
    }
    if (!boundariesById.has(targetId)) {
      throw new Error(`Unknown project boundary '${targetId}'.`);
    }
  }
}

function collectActiveAncestors(boundariesById: Map<string, BoundaryRecord>, boundaryId: string, seen = new Set<string>()): Set<string> {
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

function collectReachableActiveDescendants(boundariesById: Map<string, BoundaryRecord>, startIds: string[]): Set<string> {
  const reachable = new Set<string>();
  const queue = [...startIds];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
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

function sumBoundaryMass(boundariesById: Map<string, BoundaryRecord>, boundaryIds: string[]): number {
  return boundaryIds.reduce((total, boundaryId) => total + (boundariesById.get(boundaryId)?.weight ?? 0), 0);
}

// 兼容层保留一个轻量 score 面，但它不再是 QDD 核心协议的一部分。
export function scoreBoundaryTargets(state: BoundaryState, requestedTargetIds: string[], mode: 'targets' | 'study'): BoundaryScoreJson {
  const targetIds = uniqueSortedValues(requestedTargetIds.map((value) => value.trim()).filter((value) => value.length > 0));
  if (targetIds.length === 0) {
    throw new Error('Boundary score requires at least one target boundary.');
  }

  const boundariesById = new Map(state.boundaries.map((boundary) => [boundary.id, boundary]));
  requireKnownBoundaryIds(boundariesById, targetIds);

  const activeProjectIds = state.boundaries.filter((boundary) => isActiveBoundary(boundary)).map((boundary) => boundary.id);
  const activeProjectMass = sumBoundaryMass(boundariesById, activeProjectIds);
  const inactiveTargets = targetIds.filter((targetId) => !isActiveBoundary(boundariesById.get(targetId)!));

  const closureSet = new Set<string>();
  const missingAncestorSet = new Set<string>();

  for (const targetId of targetIds) {
    const target = boundariesById.get(targetId)!;
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
    const boundary = boundariesById.get(boundaryId)!;
    return !boundary.depends_on.some((dependencyId) => closureSet.has(dependencyId) && isActiveBoundary(boundariesById.get(dependencyId)!));
  });

  const closureMass = sumBoundaryMass(boundariesById, closure);
  const frontierMass = sumBoundaryMass(boundariesById, frontier);
  const reachableActiveIds = uniqueSortedValues([...collectReachableActiveDescendants(boundariesById, frontier)]);
  const reachableActiveMass = sumBoundaryMass(boundariesById, reachableActiveIds);
  const legal = inactiveTargets.length === 0 && missingAncestorSet.size === 0;
  const notes: string[] = ['compatibility-only'];

  if (inactiveTargets.length > 0) notes.push('inactive-targets');
  if (missingAncestorSet.size > 0) notes.push('needs-frontier-downshift');
  if (frontier.length > 1) notes.push('wide-frontier');

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

export async function scoreStudyBoundaries(projectRoot: string, studyId: string): Promise<BoundaryScoreJson> {
  const state = await readBoundaryState(projectRoot);
  const record = await readMarkdownFrontmatter<StudyRecord>(projectRoot, `${PATHS.studiesDir}/${studyId}/study.md`);
  const targetBoundaries = Array.isArray(record.target_boundaries) ? record.target_boundaries : [];

  if (targetBoundaries.length === 0) {
    throw new Error(`Study '${studyId}' has no declared target_boundaries to score.`);
  }

  return scoreBoundaryTargets(state, targetBoundaries, 'study');
}

export async function renderBoundaryGraphHtml(projectRoot: string, outputPath: string = PATHS.boundaryGraphHtml): Promise<string> {
  return renderResearchMapHtml(projectRoot, outputPath);
}
