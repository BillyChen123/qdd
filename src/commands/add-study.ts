import { createStudy } from '../runtime/lifecycle.js';
import { requireQddProjectRoot, resolveProjectRoot } from '../runtime/paths.js';

export interface AddStudyCommandOptions {
  question?: string;
  hypothesis?: string;
  blockers?: string[];
  expectedArtifacts?: string[];
}

export async function addStudyCommand(options: AddStudyCommandOptions = {}): Promise<void> {
  const projectRoot = resolveProjectRoot();
  await requireQddProjectRoot(projectRoot);

  const result = await createStudy(projectRoot, {
    question: options.question,
    hypothesis: options.hypothesis,
    blockers: options.blockers,
    expectedArtifacts: options.expectedArtifacts,
  });

  console.log(`Created study ${result.studyId}`);
  console.log(`Path: ${result.relativePath}`);
}
