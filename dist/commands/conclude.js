import { resolveProjectRoot } from '../runtime/paths.js';
import { runConclude } from '../services/conclude.js';
export async function concludeCommand(options = {}) {
    const projectRoot = resolveProjectRoot();
    const result = await runConclude(projectRoot, {
        outputDir: options.outputDir,
    });
    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    console.log(`Story candidates: ${result.storyCandidatesPath}`);
    console.log(`Evidence audit: ${result.evidenceAuditPath}`);
    console.log(`Render status: ${result.renderStatusPath}`);
    console.log(`Next step: ${result.nextStep}`);
    console.log('Selection gate: STOP until a human selects one story candidate.');
}
//# sourceMappingURL=conclude.js.map