import { resolveProjectRoot } from '../runtime/paths.js';
import { runConclude } from '../services/conclude.js';

export async function concludeCommand(options: {
  outputDir?: string;
  json?: boolean;
  selectedStoryId?: string;
  selectedStoryPath?: string;
} = {}): Promise<void> {
  const projectRoot = resolveProjectRoot();
  const result = await runConclude(projectRoot, {
    outputDir: options.outputDir,
    selectedStoryId: options.selectedStoryId,
    selectedStoryPath: options.selectedStoryPath,
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Story candidates: ${result.storyCandidatesPath}`);
  console.log(`Evidence dossier: ${result.evidenceDossierMarkdownPath}`);
  console.log(`Evidence audit: ${result.evidenceAuditPath}`);
  console.log(`Render status: ${result.renderStatusPath}`);
  console.log(`Next step: ${result.nextStep}`);
  if (result.selectionRequired) {
    console.log('Selection gate: STOP until a human selects one story candidate.');
    return;
  }

  if (result.planningArtifacts) {
    console.log(`Selected story: ${result.selectedStoryId}`);
    console.log(`Planning artifacts: ${result.planningArtifacts.paperRewritingOutputDir}`);
  }
}
