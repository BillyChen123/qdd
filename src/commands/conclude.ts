import { requireQddProjectRoot, resolveProjectRoot } from '../runtime/paths.js';
import { runConclude } from '../services/conclude.js';

export async function concludeCommand(options: { outputDir?: string; json?: boolean } = {}): Promise<void> {
  const projectRoot = resolveProjectRoot();
  await requireQddProjectRoot(projectRoot);

  const result = await runConclude(projectRoot, {
    outputDir: options.outputDir,
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const availableTools = result.preflight.rendering_tools.filter((tool) => tool.available).map((tool) => tool.tool);
  console.log(`Evidence audit: ${result.evidence_audit_path}`);
  console.log(`Evidence items: ${result.summary.evidence_item_count}`);
  console.log(`Evidence clues: ${result.summary.clue_count}`);
  console.log(`Available rendering tools: ${availableTools.join(', ') || 'none'}`);
}
