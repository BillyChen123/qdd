import type { ArtifactIndex } from './artifacts.js';
import type { ResearchContract } from './core.js';
import type { EvolutionState } from './evolution.js';
import type { StudyRecord, TaskRecord } from './studies.js';

export type ConcludeAvailability = 'available' | 'blocked';

export type ConcludeRenderToolName = 'latexmk' | 'xelatex' | 'pdflatex' | 'pandoc';

export interface ConcludeRenderToolStatus {
  name: ConcludeRenderToolName;
  status: ConcludeAvailability;
  available: boolean;
  resolvedPath: string | null;
}

export interface ConcludeRenderTargetStatus {
  status: ConcludeAvailability;
  reasons: string[];
  notes: string[];
}

export interface ConcludePathStatus {
  path: string;
  kind: 'file' | 'directory' | 'collection';
  required: boolean;
  status: ConcludeAvailability;
  details: string;
  count?: number;
}

export interface ConcludeTaskSnapshot {
  taskId: string;
  relativePath: string;
  record: TaskRecord;
  body: string;
}

export interface ConcludeStudySnapshot {
  studyId: string;
  relativePath: string;
  record: StudyRecord;
  body: string;
  tasks: ConcludeTaskSnapshot[];
  outputDir: string;
  outputDirExists: boolean;
  artifactCandidatesPath: string | null;
  publicDataRequestPath: string | null;
}

export interface ConcludeStudyMemorySnapshot {
  studyId: string | null;
  relativePath: string;
  content: string;
}

export interface ConcludePreflightSnapshot {
  contract: ResearchContract | null;
  evolution: EvolutionState | null;
  resourcesMarkdown: string | null;
  artifactIndex: ArtifactIndex | null;
  studyMemories: ConcludeStudyMemorySnapshot[];
  studies: ConcludeStudySnapshot[];
}

export interface ConcludeRenderStatus {
  status: ConcludeAvailability;
  reasons: string[];
  notes: string[];
  pdf: ConcludeRenderTargetStatus;
  word: ConcludeRenderTargetStatus;
  tools: Record<ConcludeRenderToolName, ConcludeRenderToolStatus>;
}

export interface ConcludePreflightResult {
  projectRoot: string;
  qddProjectRoot: boolean;
  projectStatus: ConcludeAvailability;
  projectBlockers: string[];
  warnings: string[];
  checkedPaths: {
    contract: ConcludePathStatus;
    evolution: ConcludePathStatus;
    resources: ConcludePathStatus;
    memory: ConcludePathStatus;
    artifactIndex: ConcludePathStatus;
    studies: ConcludePathStatus;
  };
  snapshot: ConcludePreflightSnapshot;
  render: ConcludeRenderStatus;
}

export interface ConcludePreflightOptions {
  environment?: NodeJS.ProcessEnv;
  shellPath?: string;
}
