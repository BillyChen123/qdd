import { runAuto } from '../runtime/orchestrator.js';
import { resolveClaudeModel } from '../runtime/agent-runner.js';
import { createAutoConsoleRenderer } from '../ui/auto-stream.js';
import { FileSystemUtils } from '../utils/file-system.js';
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
function parseMaxTurns(value) {
    if (value === undefined)
        return DEFAULT_MAX_TURNS_PER_AGENT;
    const normalized = value.trim().toLowerCase();
    if (['0', 'none', 'unlimited', 'off'].includes(normalized))
        return null;
    return parsePositiveInteger(value, DEFAULT_MAX_TURNS_PER_AGENT, '--max-turns');
}
async function resolveAutoPrompt(positionalPrompt, options) {
    const prompts = [
        positionalPrompt?.trim(),
        options.prompt?.trim(),
    ].filter((value) => Boolean(value));
    if (options.promptFile) {
        prompts.push((await FileSystemUtils.readFile(options.promptFile)).trim());
    }
    if (prompts.length === 0)
        return undefined;
    return prompts.join('\n\n');
}
export async function autoCommand(projectRoot, promptArg, options) {
    const projectRootPath = projectRoot || process.cwd();
    const prompt = await resolveAutoPrompt(promptArg, options);
    const autoOptions = {
        model: resolveClaudeModel(options.model),
        maxIterations: parsePositiveInteger(options.maxIterations, DEFAULT_MAX_ITERATIONS, '--max-iterations'),
        maxTurnsPerAgent: parseMaxTurns(options.maxTurns),
        dryRun: options.dryRun ?? false,
        verbose: options.verbose ?? false,
        prompt,
    };
    if (options.json) {
        const result = await runAuto(projectRootPath, {
            ...autoOptions,
            logger: () => undefined,
        });
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    const renderer = createAutoConsoleRenderer({ verbose: autoOptions.verbose });
    const result = await runAuto(projectRootPath, {
        ...autoOptions,
        events: renderer.events,
        logger: () => undefined,
    });
    renderer.finish(result);
}
//# sourceMappingURL=auto.js.map