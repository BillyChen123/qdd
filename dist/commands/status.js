import { buildStatus } from '../runtime/status.js';
import { requireQddProjectRoot, resolveProjectRoot } from '../runtime/paths.js';
export async function statusCommand(options = {}) {
    const projectRoot = resolveProjectRoot();
    await requireQddProjectRoot(projectRoot);
    const status = await buildStatus(projectRoot);
    if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
    }
    console.log(`Theme: ${status.project.theme}`);
    console.log(`Mode: ${status.project.mode}`);
    console.log(`Current question: ${status.project.current_question}`);
    console.log(`Active studies: ${status.studies.active.length}`);
    console.log(`Closed studies: ${status.studies.closed.length}`);
    console.log(`Completed tasks pending promotion review: ${status.tasks.promotion_pending.length}`);
    console.log(`Studies with unpackaged output: ${status.output_review.studies_with_unpackaged_output.length}`);
    console.log(`Artifacts: ${status.artifacts.count}`);
}
//# sourceMappingURL=status.js.map