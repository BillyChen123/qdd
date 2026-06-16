import { runAuto } from '../runtime/orchestrator.js';
import type { AutoOptions, AutoResult } from '../runtime/orchestrator.js';
import { resolveClaudeModel } from '../runtime/agent-runner.js';
import { createAutoConsoleRenderer } from '../ui/auto-stream.js';
import { FileSystemUtils } from '../utils/file-system.js';

function parsePositiveInteger(value: string, optionName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || `${parsed}` !== value.trim()) {
    throw new Error(`${optionName} must be a positive integer.`);
  }
  return parsed;
}

function parseOptionalPositiveInteger(value: string | undefined, optionName: string): number | null {
  if (value === undefined) return null;
  const normalized = value.trim().toLowerCase();
  if (['0', 'none', 'unlimited', 'off'].includes(normalized)) return null;
  return parsePositiveInteger(value, optionName);
}

export function parseAutoMaxIterationsForTest(value: string | undefined): number | null {
  return parseOptionalPositiveInteger(value, '--max-iterations');
}

export function parseAutoMaxTurnsForTest(value: string | undefined): number | null {
  return parseOptionalPositiveInteger(value, '--max-turns');
}

async function resolveAutoPrompt(positionalPrompt: string | undefined, options: { prompt?: string; promptFile?: string }): Promise<string | undefined> {
  const prompts = [
    positionalPrompt?.trim(),
    options.prompt?.trim(),
  ].filter((value): value is string => Boolean(value));

  if (options.promptFile) {
    prompts.push((await FileSystemUtils.readFile(options.promptFile)).trim());
  }

  if (prompts.length === 0) return undefined;
  return prompts.join('\n\n');
}

export async function autoCommand(
  projectRoot: string,
  promptArg: string | undefined,
  options: {
    model?: string;
    maxIterations?: string;
    maxTurns?: string;
    dryRun?: boolean;
    json?: boolean;
    verbose?: boolean;
    prompt?: string;
    promptFile?: string;
  }
): Promise<void> {
  const projectRootPath = projectRoot || process.cwd();
  const prompt = await resolveAutoPrompt(promptArg, options);

  const autoOptions: AutoOptions = {
    model: resolveClaudeModel(options.model),
    maxIterations: parseAutoMaxIterationsForTest(options.maxIterations),
    maxTurnsPerAgent: parseAutoMaxTurnsForTest(options.maxTurns),
    dryRun: options.dryRun ?? false,
    verbose: options.verbose ?? false,
    prompt,
  };

  if (options.json) {
    const result: AutoResult = await runAuto(projectRootPath, {
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
