import { applyBoundaryUpdates, readBoundaryState, renderBoundaryGraphHtml, summarizeBoundaryState } from '../runtime/boundaries.js';
import { PATHS } from '../runtime/constants.js';
import { requireQddProjectRoot, resolveProjectRoot } from '../runtime/paths.js';
export async function boundariesCommand(options = {}) {
    const projectRoot = resolveProjectRoot();
    await requireQddProjectRoot(projectRoot);
    const state = await readBoundaryState(projectRoot);
    const summary = summarizeBoundaryState(state);
    if (options.json) {
        console.log(JSON.stringify({ boundaries: state.boundaries, summary }, null, 2));
        return;
    }
    console.log(`Boundaries: ${summary.total}`);
    console.log(`Active: ${summary.active.join(', ') || 'none'}`);
    for (const boundary of state.boundaries) {
        console.log(`${boundary.id} [${boundary.status}] w=${boundary.weight} deps=${boundary.depends_on.join(', ') || '-'} :: ${boundary.text}`);
    }
}
export async function boundariesApplyCommand(file, options = {}) {
    if (!file?.trim()) {
        throw new Error('Missing required option --file <updates.yaml>.');
    }
    const projectRoot = resolveProjectRoot();
    await requireQddProjectRoot(projectRoot);
    const result = await applyBoundaryUpdates(projectRoot, file);
    const summary = summarizeBoundaryState(result.state);
    if (options.json) {
        console.log(JSON.stringify({
            applied_from: file,
            updates: result.updates,
            summary,
            boundaries: result.state.boundaries,
        }, null, 2));
        return;
    }
    console.log(`Applied ${result.updates.length} boundary updates from ${file}`);
    console.log(`Active boundaries: ${summary.active.join(', ') || 'none'}`);
}
export async function boundariesRenderCommand(options = {}) {
    const projectRoot = resolveProjectRoot();
    await requireQddProjectRoot(projectRoot);
    const outputPath = options.output?.trim() || PATHS.boundaryGraphHtml;
    const renderedPath = await renderBoundaryGraphHtml(projectRoot, outputPath);
    if (options.json) {
        console.log(JSON.stringify({ output: renderedPath }, null, 2));
        return;
    }
    console.log(`Rendered boundary graph to ${renderedPath}`);
}
//# sourceMappingURL=boundaries.js.map