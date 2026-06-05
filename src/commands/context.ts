import { listContext } from '../services/inspection.js';
import { requireQddProjectRoot, resolveProjectRoot } from '../runtime/paths.js';

export async function contextCommand(options: { json?: boolean } = {}): Promise<void> {
  const projectRoot = resolveProjectRoot();
  await requireQddProjectRoot(projectRoot);

  const result = await listContext(projectRoot);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.context.length === 0) {
    console.log('No context files found.');
    return;
  }

  for (const entry of result.context) {
    console.log(`${entry.path}`);
  }
}
