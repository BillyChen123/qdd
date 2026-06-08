import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs/promises';
import { buildStatus } from './status.js';
import { buildInstructions } from './instructions.js';
import { createStudy } from './lifecycle.js';
import type { InstructionsJson } from '../types.js';
import { runAgent } from './agent-runner.js';
import type { AgentRunResult } from './agent-runner.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const bootstrapPromptDir = path.join(moduleDir, 'bootstrap-prompts');

export interface AutoOptions {
  model: string;
  maxIterations: number;
  maxTurnsPerAgent: number;
  dryRun: boolean;
}

export interface AutoResult {
  iterations: number;
  studiesCompleted: number;
  finalPhase: string;
  summary: string;
  phases: Array<{ phase: string; target: string; command: string; role: string; result: AgentRunResult }>;
}

type OrchestratorPhase = 'start' | 'propose' | 'apply' | 'close';

async function readPromptFile(name: string): Promise<string> {
  return fs.readFile(path.join(bootstrapPromptDir, `${name}.md`), 'utf-8');
}

function extractTextBetween(
  content: string,
  startMarker: string,
  endMarker: string
): string | null {
  const startIdx = content.indexOf(startMarker);
  if (startIdx === -1) return null;
  const endIdx = content.indexOf(endMarker, startIdx + startMarker.length);
  if (endIdx === -1) return content.slice(startIdx);
  return content.slice(startIdx, endIdx + endMarker.length);
}

function formatInstructionsForAgent(instructions: InstructionsJson): string {
  const lines: string[] = [];

  lines.push(`## Role: ${instructions.role}`);
  lines.push(`## Command: ${instructions.command ?? 'none'}`);
  lines.push(`## Target: ${instructions.target.kind} / ${instructions.target.id}`);
  lines.push('');

  if (instructions.read.length > 0) {
    lines.push('### Files You May Read');
    for (const p of instructions.read) lines.push(`- ${p}`);
    lines.push('');
  }

  if (instructions.write.length > 0) {
    lines.push('### Files You May Write');
    for (const p of instructions.write) lines.push(`- ${p}`);
    lines.push('');
  }

  if (instructions.required_skills.length > 0) {
    lines.push('### Required Skills');
    for (const s of instructions.required_skills) lines.push(`- ${s}`);
    lines.push('');
  }

  if (instructions.rules.length > 0) {
    lines.push('### Rules');
    for (const r of instructions.rules) lines.push(`- ${r}`);
    lines.push('');
  }

  return lines.join('\n');
}

function parseCurrentStudyId(status: Awaited<ReturnType<typeof buildStatus>>): string | null {
  const active = status.studies.active;
  if (active.length > 0) return active[active.length - 1];
  const blocked = status.studies.blocked;
  if (blocked.length > 0) return blocked[blocked.length - 1];
  return null;
}

function determineNextStudyId(status: Awaited<ReturnType<typeof buildStatus>>): string {
  const allStudies = new Set([
    ...status.studies.active,
    ...status.studies.blocked,
    ...status.studies.completed,
    ...status.studies.closed,
  ]);

  let maxNum = 0;
  for (const sid of allStudies) {
    const match = sid.match(/^STUDY-(\d{3})$/);
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
  }

  return `STUDY-${String(maxNum + 1).padStart(3, '0')}`;
}

function checkTermination(status: Awaited<ReturnType<typeof buildStatus>>): {
  shouldTerminate: boolean;
  reason: string;
} {
  const qs = status.question_state;

  if (qs.last_kind === 'confirmation') {
    return { shouldTerminate: true, reason: 'Research question has been sufficiently answered (confirmation).' };
  }
  if (qs.last_kind === 'dissolution') {
    return { shouldTerminate: true, reason: 'Question is undecidable within current resource boundaries (dissolution).' };
  }
  if (qs.open_boundary_ids.length === 0) {
    return { shouldTerminate: true, reason: 'No remaining open boundaries — research frontier is closed.' };
  }
  if (qs.next_candidates.length === 0) {
    return { shouldTerminate: true, reason: 'No credible follow-up directions exist.' };
  }

  return { shouldTerminate: false, reason: '' };
}

function computeInitialPhase(
  status: Awaited<ReturnType<typeof buildStatus>>
): { phase: OrchestratorPhase; target: string; command: string } {
  const allStudies = [
    ...status.studies.active,
    ...status.studies.blocked,
    ...status.studies.completed,
    ...status.studies.closed,
  ];

  if (allStudies.length === 0) {
    return { phase: 'start', target: 'PROJECT', command: 'qdd-start' };
  }

  const studyId = parseCurrentStudyId(status);
  if (!studyId) {
    // All studies are closed
    return { phase: 'propose', target: determineNextStudyId(status), command: 'qdd-propose' };
  }

  // Determine what phase this study is in by checking tasks
  const pendingTasks = status.tasks.pending;
  const runningTasks = status.tasks.running;
  const blockedTasks = status.tasks.blocked;
  const completedTasks = status.tasks.completed;
  const allTaskIds = [...pendingTasks, ...runningTasks, ...blockedTasks, ...completedTasks];

  const hasTasks = allTaskIds.length > 0;
  const allDone = pendingTasks.length === 0 && runningTasks.length === 0 && blockedTasks.length === 0;

  if (!hasTasks) {
    return { phase: 'propose', target: studyId, command: 'qdd-propose' };
  }

  if (allDone) {
    return { phase: 'close', target: studyId, command: 'qdd-close' };
  }

  return { phase: 'apply', target: studyId, command: 'qdd-apply' };
}

function nextPhase(
  currentPhase: OrchestratorPhase,
  status: Awaited<ReturnType<typeof buildStatus>>
): { phase: OrchestratorPhase; target: string; command: string } | null {
  switch (currentPhase) {
    case 'start':
      return {
        phase: 'propose',
        target: determineNextStudyId(status),
        command: 'qdd-propose',
      };
    case 'propose': {
      const studyId = parseCurrentStudyId(status);
      if (!studyId) return null;
      return { phase: 'apply', target: studyId, command: 'qdd-apply' };
    }
    case 'apply': {
      const studyId = parseCurrentStudyId(status);
      if (!studyId) return null;
      return { phase: 'close', target: studyId, command: 'qdd-close' };
    }
    case 'close': {
      const term = checkTermination(status);
      if (term.shouldTerminate) return null;
      return {
        phase: 'propose',
        target: determineNextStudyId(status),
        command: 'qdd-propose',
      };
    }
    default:
      return null;
  }
}

function commandToBootstrapFile(command: string): string {
  return command; // qdd-start → qdd-start.md, etc.
}

function phaseLabel(phase: OrchestratorPhase): string {
  switch (phase) {
    case 'start': return 'Thesis Manager (qdd-start)';
    case 'propose': return 'Study Brain (qdd-propose)';
    case 'apply': return 'Executor (qdd-apply)';
    case 'close': return 'Thesis Manager (qdd-close)';
  }
}

export async function runAuto(
  projectRoot: string,
  options: AutoOptions
): Promise<AutoResult> {
  const phases: AutoResult['phases'] = [];
  let iterations = 0;
  let studiesCompleted = 0;

  // Step 1: Read current project state
  let status = await buildStatus(projectRoot);

  // Step 2: Determine starting phase
  let current = computeInitialPhase(status);

  console.log(`Auto mode starting from phase: ${phaseLabel(current.phase)}`);
  console.log(`Target: ${current.target}, Command: ${current.command}`);
  console.log(`Model: ${options.model}, Max iterations: ${options.maxIterations}`);
  console.log('');

  while (iterations < options.maxIterations) {
    iterations++;

    console.log(`--- Iteration ${iterations}: ${phaseLabel(current.phase)} ---`);

    // For propose phase, ensure the study scaffold exists before getting instructions
    if (current.phase === 'propose' && current.target.startsWith('STUDY-')) {
      try {
        await buildInstructions(projectRoot, current.target, { command: 'qdd-propose' });
      } catch {
        // Study doesn't exist yet — create a minimal scaffold
        await createStudy(projectRoot, {
          question: 'To be refined by Study Brain agent during qdd-propose.',
          hypothesis: 'To be formulated.',
        });
        // After creation, the study will have an auto-generated ID. If our target
        // doesn't match, we need to re-read status and adjust.
        status = await buildStatus(projectRoot);
        const createdStudyId = parseCurrentStudyId(status) ?? current.target;
        if (createdStudyId !== current.target) {
          console.log(`  Study scaffold created as ${createdStudyId} (requested: ${current.target})`);
          current = { ...current, target: createdStudyId };
        } else {
          console.log(`  Created study scaffold: ${current.target}`);
        }
      }
    }

    // Get instructions for the current phase
    const instructions = await buildInstructions(projectRoot, current.target, {
      command: current.command as 'qdd-start' | 'qdd-propose' | 'qdd-apply' | 'qdd-close',
    });

    // Read the bootstrap prompt as system prompt
    const bootstrapFile = commandToBootstrapFile(current.command);
    const systemPrompt = await readPromptFile(bootstrapFile);

    if (options.dryRun) {
      console.log(`[DRY RUN] Would run agent with:`);
      console.log(`  Role: ${instructions.role}`);
      console.log(`  Target: ${current.target}`);
      console.log(`  Command: ${current.command}`);
      console.log(`  System prompt: ${bootstrapFile}.md`);
      console.log('');

      // Simulate phase transition
      const next = nextPhase(current.phase, status);
      if (!next) {
        console.log('Termination condition met. Stopping.');
        break;
      }
      if (current.phase === 'close') studiesCompleted++;
      current = { phase: next.phase, target: next.target, command: next.command };
      continue;
    }

    // Run the agent
    const instructionsText = formatInstructionsForAgent(instructions);
    const result = await runAgent({
      model: options.model,
      systemPrompt,
      instructions: instructionsText,
      maxTurns: options.maxTurnsPerAgent,
      cwd: projectRoot,
    });

    phases.push({
      phase: current.phase,
      target: current.target,
      command: current.command,
      role: instructions.role,
      result,
    });

    console.log(`  Turns: ${result.turns}, Tool calls: ${result.toolCalls}`);
    console.log(`  Terminated normally: ${result.terminatedNormally}`);
    console.log('');

    if (current.phase === 'close') studiesCompleted++;

    // Re-read status after agent execution
    status = await buildStatus(projectRoot);

    // Determine next phase
    const next = nextPhase(current.phase, status);
    if (!next) {
      const term = checkTermination(status);
      console.log(`Termination: ${term.reason}`);
      break;
    }

    current = { phase: next.phase, target: next.target, command: next.command };
  }

  if (iterations >= options.maxIterations) {
    console.log(`Reached max iterations (${options.maxIterations}). Stopping.`);
  }

  return {
    iterations,
    studiesCompleted,
    finalPhase: current.phase,
    summary: `Auto mode completed: ${iterations} iterations, ${studiesCompleted} studies closed.`,
    phases,
  };
}
