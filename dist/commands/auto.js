import { runAuto } from '../runtime/orchestrator.js';
import { resolveClaudeModel } from '../runtime/agent-runner.js';
const DEFAULT_MAX_ITERATIONS = 20;
const DEFAULT_MAX_TURNS_PER_AGENT = 50;
function parsePositiveInteger(value, fallback, optionName) {
    if (value === undefined)
        return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || `${parsed}` !== value.trim()) {
        throw new Error(`${optionName} must be a positive integer.`);
    }
    return parsed;
}
export async function autoCommand(projectRoot, options) {
    const projectRootPath = projectRoot || process.cwd();
    const autoOptions = {
        model: resolveClaudeModel(options.model),
        maxIterations: parsePositiveInteger(options.maxIterations, DEFAULT_MAX_ITERATIONS, '--max-iterations'),
        maxTurnsPerAgent: parsePositiveInteger(options.maxTurns, DEFAULT_MAX_TURNS_PER_AGENT, '--max-turns'),
        dryRun: options.dryRun ?? false,
    };
    if (options.json) {
        const result = await runAuto(projectRootPath, {
            ...autoOptions,
            logger: () => undefined,
        });
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    console.log('QDD Auto Research Loop');
    console.log('=====================');
    console.log(`Project: ${projectRootPath}`);
    console.log('');
    const result = await runAuto(projectRootPath, autoOptions);
    console.log('');
    console.log('=====================');
    console.log(`Completed: ${result.iterations} iterations, ${result.studiesCompleted} studies.`);
    console.log(`Final phase: ${result.finalPhase}`);
    console.log(`Stop reason: ${result.terminalReason}`);
    console.log(result.summary);
}
//# sourceMappingURL=auto.js.map