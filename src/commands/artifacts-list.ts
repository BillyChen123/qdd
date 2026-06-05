import { listArtifacts } from '../services/inspection.js';
import { requireQddProjectRoot, resolveProjectRoot } from '../runtime/paths.js';

export async function artifactsListCommand(options: { json?: boolean } = {}): Promise<void> {
  const projectRoot = resolveProjectRoot();
  await requireQddProjectRoot(projectRoot);

  const result = await listArtifacts(projectRoot);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.artifacts.length === 0) {
    console.log('No artifacts registered.');
    return;
  }

  for (const artifact of result.artifacts) {
    console.log(`${artifact.id} ${artifact.type} ${artifact.path} (${artifact.produced_by})`);
  }
}
