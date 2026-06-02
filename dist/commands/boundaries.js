import { applyBoundaryUpdates, readBoundaryState, renderBoundaryGraphHtml, scoreBoundaryTargets, scoreStudyBoundaries, summarizeBoundaryState } from '../runtime/boundaries.js';
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
function parseTargetIds(rawTargets) {
    if (!rawTargets?.trim()) {
        return [];
    }
    return rawTargets
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
}
export async function boundariesScoreCommand(options = {}) {
    const hasTargets = !!options.targets?.trim();
    const hasStudy = !!options.study?.trim();
    if (hasTargets === hasStudy) {
        throw new Error('Choose exactly one of --targets <B001,B002> or --study <STUDY-XXX>.');
    }
    const projectRoot = resolveProjectRoot();
    await requireQddProjectRoot(projectRoot);
    const score = hasStudy
        ? await scoreStudyBoundaries(projectRoot, options.study.trim())
        : scoreBoundaryTargets(await readBoundaryState(projectRoot), parseTargetIds(options.targets), 'targets');
    if (options.json) {
        console.log(JSON.stringify(score, null, 2));
        return;
    }
    console.log(`Mode: ${score.mode}`);
    console.log(`Targets: ${score.target_boundaries.join(', ')}`);
    console.log(`Legal: ${score.legal ? 'yes' : 'no'}`);
    console.log(`Missing active ancestors: ${score.missing_active_ancestors.join(', ') || 'none'}`);
    console.log(`Suggested frontier: ${score.suggested_frontier.join(', ') || 'none'}`);
    console.log(`Closure: ${score.closure.join(', ') || 'none'} (mass=${score.closure_mass})`);
    console.log(`Frontier: ${score.frontier.join(', ') || 'none'} (mass=${score.frontier_mass})`);
    console.log(`Reachable active mass: ${score.reachable_active_mass}/${score.active_project_mass}`);
    console.log(`Quality: ${score.quality_score}`);
    console.log(`Priority: ${score.priority_score}`);
    console.log(`Notes: ${score.notes.join(', ') || 'none'}`);
}
//# sourceMappingURL=boundaries.js.map