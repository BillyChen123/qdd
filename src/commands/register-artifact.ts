import { registerArtifact } from '../services/artifacts.js';
import { requireQddProjectRoot, resolveProjectRoot } from '../runtime/paths.js';
import type { ArtifactScope, ArtifactType } from '../types.js';

export interface RegisterArtifactCommandOptions {
  type?: ArtifactType;
  description?: string;
  reusable?: boolean;
  study?: string;
  task?: string;
  scope?: ArtifactScope;
  schema?: string;
}

export async function registerArtifactCommand(
  artifactPath: string | undefined,
  options: RegisterArtifactCommandOptions = {}
): Promise<void> {
  if (!artifactPath) {
    throw new Error('Missing required argument <path>.');
  }

  if (!options.type) {
    throw new Error('Missing required option --type <data|code|figure|table|report>.');
  }

  if (!options.description) {
    throw new Error('Missing required option --description <text>.');
  }

  const projectRoot = resolveProjectRoot();
  await requireQddProjectRoot(projectRoot);

  const result = await registerArtifact(projectRoot, artifactPath, {
    artifactType: options.type,
    description: options.description,
    reusable: options.reusable ?? false,
    studyId: options.study,
    taskId: options.task,
    scope: options.scope,
    schema: options.schema,
  });

  console.log(`Registered artifact ${result.artifactId}`);
  console.log(`Path: ${result.entry.path}`);
}
