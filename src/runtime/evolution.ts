import path from 'node:path';
import * as fs from 'node:fs/promises';
import type {
  BoundaryRecord,
  BoundaryState,
  EvolutionBoundary,
  EvolutionBoundaryState,
  EvolutionState,
  EvolutionStudyEvent,
  LegacyEvolutionTrail,
  QuestionChangeType,
  ResearchContract,
} from '../types.js';
import { createDefaultEvolutionState as createDefaultEvolutionStateFromContract } from '../file-contracts/evolution.js';
import { buildStudyMemoryMarkdown as buildStudyMemoryMarkdownFromContract } from '../file-contracts/memory.js';
import { renderResearchMapHtmlFromState } from '../render/research-map.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
import { readYamlFile, writeYamlFile } from './store.js';

const BOUNDARY_ID_PATTERN = /^B\d{3}$/;
const STUDY_MEMORY_PATTERN = /^STUDY-\d{3}\.md$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTextKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function nextBoundaryId(boundaries: EvolutionBoundary[]): string {
  const highest = boundaries.reduce((max, boundary) => {
    const match = boundary.id.match(/^B(\d{3})$/);
    return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
  }, 0);
  return `B${String(highest + 1).padStart(3, '0')}`;
}

function normalizeBoundaryState(value: unknown): EvolutionBoundaryState {
  return String(value ?? '').trim() === 'resolved' ? 'resolved' : 'open';
}

function normalizeBoundary(raw: unknown, index: number): EvolutionBoundary {
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

  return {
    id,
    text,
    state: normalizeBoundaryState(raw.state),
  };
}

function normalizeStudyEvent(raw: unknown, index: number): EvolutionStudyEvent {
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
    kind: kind as QuestionChangeType,
    resolves,
    opens,
    candidates,
    ts,
  };
}

function normalizeEvolutionState(raw: unknown): EvolutionState {
  if (!isRecord(raw)) {
    throw new Error('evolution.yaml must define an object.');
  }

  const studies = Array.isArray(raw.studies) ? raw.studies.map((entry, index) => normalizeStudyEvent(entry, index)) : [];
  const boundaries = Array.isArray(raw.boundaries)
    ? raw.boundaries.map((entry, index) => normalizeBoundary(entry, index))
    : [];

  const seenIds = new Set<string>();
  for (const boundary of boundaries) {
    if (seenIds.has(boundary.id)) {
      throw new Error(`evolution.yaml contains duplicate boundary id '${boundary.id}'.`);
    }
    seenIds.add(boundary.id);
  }

  for (const boundary of boundaries) {
    if (!boundary.id || !boundary.text) {
      throw new Error(`evolution.yaml boundary '${boundary.id || `#${boundaries.indexOf(boundary)}`}' is invalid.`);
    }
  }

  return {
    studies,
    boundaries: boundaries.sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function convertLegacyEvolution(legacy: LegacyEvolutionTrail): EvolutionState {
  const boundaries: EvolutionBoundary[] = [];
  const studies: EvolutionStudyEvent[] = [];

  for (const entry of legacy.evolution_trail ?? []) {
    const delta = entry.question_delta;
    const openTexts = Array.isArray(delta?.open_boundaries)
      ? delta.open_boundaries.map((value) => String(value).trim()).filter((value) => value.length > 0)
      : [];
    const currentOpen = boundaries.filter((boundary) => boundary.state === 'open');
    const nextOpenKeys = new Set(openTexts.map((value) => normalizeTextKey(value)));
    const resolves: string[] = [];
    const opens: string[] = [];

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

      const newBoundary: EvolutionBoundary = {
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
      kind: (delta?.change_type ?? 'refinement') as QuestionChangeType,
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

export function createDefaultEvolutionState(): EvolutionState {
  return createDefaultEvolutionStateFromContract();
}

export async function readEvolutionState(projectRoot: string): Promise<EvolutionState> {
  const absolutePath = path.join(projectRoot, PATHS.evolution);
  if (!(await FileSystemUtils.fileExists(absolutePath))) {
    return createDefaultEvolutionState();
  }

  const raw = await readYamlFile<unknown>(projectRoot, PATHS.evolution);
  if (isRecord(raw) && Array.isArray(raw.evolution_trail)) {
    return convertLegacyEvolution(raw as unknown as LegacyEvolutionTrail);
  }

  return normalizeEvolutionState(raw);
}

export async function writeEvolutionState(projectRoot: string, state: EvolutionState): Promise<void> {
  await writeYamlFile(projectRoot, PATHS.evolution, {
    studies: state.studies,
    boundaries: state.boundaries,
  });
}

export function summarizeEvolutionBoundaries(state: EvolutionState): {
  total: number;
  open: number;
  resolved: number;
  active: string[];
} {
  const summary = {
    total: state.boundaries.length,
    open: 0,
    resolved: 0,
    active: [] as string[],
  };

  for (const boundary of state.boundaries) {
    if (boundary.state === 'open') {
      summary.open += 1;
      summary.active.push(boundary.id);
    } else {
      summary.resolved += 1;
    }
  }

  return summary;
}

export function getCurrentProjectQuestion(contract: ResearchContract, state: EvolutionState): string {
  return state.studies.at(-1)?.question || contract.initial_question;
}

export function toBoundaryState(state: EvolutionState): BoundaryState {
  return {
    boundaries: state.boundaries.map<BoundaryRecord>((boundary) => ({
      id: boundary.id,
      text: boundary.text,
      depends_on: [],
      weight: 1,
      status: boundary.state === 'resolved' ? 'resolved' : 'open',
    })),
  };
}

export function mergeBoundaryStateIntoEvolution(state: EvolutionState, boundaryState: BoundaryState): EvolutionState {
  return {
    studies: state.studies,
    boundaries: boundaryState.boundaries.map((boundary) => ({
      id: boundary.id,
      text: boundary.text,
      state: boundary.status === 'resolved' || boundary.status === 'dissolved' ? 'resolved' : 'open',
    })),
  };
}

export function applyOpenBoundaryTexts(
  state: EvolutionState,
  studyId: string,
  studyQuestion: string,
  kind: QuestionChangeType,
  openBoundaryTexts: string[],
  candidates: string[]
): EvolutionState {
  const normalizedOpenTexts = [...new Set(openBoundaryTexts.map((value) => value.trim()).filter((value) => value.length > 0))];
  const nextState: EvolutionState = {
    studies: [...state.studies],
    boundaries: state.boundaries.map((boundary) => ({ ...boundary })),
  };

  const currentOpen = nextState.boundaries.filter((boundary) => boundary.state === 'open');
  const requestedKeys = new Set(normalizedOpenTexts.map((value) => normalizeTextKey(value)));
  const resolves: string[] = [];
  const opens: string[] = [];

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

    const newBoundary: EvolutionBoundary = {
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

export async function listStudyMemoryPaths(projectRoot: string): Promise<string[]> {
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

export async function listRecentStudyMemoryPaths(projectRoot: string, limit = 5): Promise<string[]> {
  return (await listStudyMemoryPaths(projectRoot)).slice(0, limit);
}

export function buildStudyMemoryMarkdown(options: {
  studyId: string;
  question: string;
  kind: QuestionChangeType;
  summary: string;
  promotedArtifacts: string[];
  reusedMaterials: string[];
  usedSkills: string[];
  adHocScripts: string[];
  openBoundaryTexts: string[];
  nextCandidates: string[];
  resolvedBoundaryTexts: string[];
}): string {
  return buildStudyMemoryMarkdownFromContract(options);
}

export async function writeStudyMemory(projectRoot: string, studyId: string, markdown: string): Promise<string> {
  const relativePath = `${PATHS.contextMemoryDir}/${studyId}.md`;
  await FileSystemUtils.writeFile(path.join(projectRoot, relativePath), markdown);
  return relativePath;
}

export async function renderResearchMapHtml(projectRoot: string, outputPath: string = PATHS.researchMapHtml): Promise<string> {
  const state = await readEvolutionState(projectRoot);
  return renderResearchMapHtmlFromState(projectRoot, state, outputPath);
}
