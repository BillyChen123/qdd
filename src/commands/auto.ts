import { runAuto } from '../runtime/orchestrator.js';
import type { AutoOptions, AutoResult } from '../runtime/orchestrator.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_ITERATIONS = 20;
const DEFAULT_MAX_TURNS_PER_AGENT = 50;

export async function autoCommand(
  projectRoot: string,
  options: {
    model?: string;
    maxIterations?: string;
    maxTurns?: string;
    dryRun?: boolean;
    json?: boolean;
  }
): Promise<void> {
  const projectRootPath = projectRoot || process.cwd();

  const autoOptions: AutoOptions = {
    model: options.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
    maxIterations: options.maxIterations ? parseInt(options.maxIterations, 10) : DEFAULT_MAX_ITERATIONS,
    maxTurnsPerAgent: options.maxTurns ? parseInt(options.maxTurns, 10) : DEFAULT_MAX_TURNS_PER_AGENT,
    dryRun: options.dryRun ?? false,
  };

  if (options.json) {
    const result: AutoResult = await runAuto(projectRootPath, autoOptions);
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
  console.log(result.summary);
}
