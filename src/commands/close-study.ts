import { closeStudy } from '../runtime/lifecycle.js';
import { requireQddProjectRoot, resolveProjectRoot } from '../runtime/paths.js';
import type { QuestionChangeType } from '../types.js';

export interface CloseStudyCommandOptions {
  changeType?: QuestionChangeType;
  summary?: string;
  openBoundaries?: string[];
  nextCandidates?: string[];
}

export async function closeStudyCommand(studyId: string | undefined, options: CloseStudyCommandOptions = {}): Promise<void> {
  if (!studyId) {
    throw new Error('Missing required argument <study-id>.');
  }

  if (!options.changeType) {
    throw new Error('Missing required option --change-type <refinement|confirmation|pivot|dissolution>.');
  }

  if (!options.summary) {
    throw new Error('Missing required option --summary <text>.');
  }

  const projectRoot = resolveProjectRoot();
  await requireQddProjectRoot(projectRoot);

  await closeStudy(projectRoot, studyId, {
    changeType: options.changeType,
    summary: options.summary,
    openBoundaries: options.openBoundaries ?? [],
    nextCandidates: options.nextCandidates ?? [],
  });

  console.log(`Closed study ${studyId}`);
}
