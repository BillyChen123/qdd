import { createTask } from '../runtime/lifecycle.js';
import { requireQddProjectRoot, resolveProjectRoot } from '../runtime/paths.js';

export interface AddTaskCommandOptions {
  goal?: string;
  dependsOn?: string[];
  inputs?: string[];
  expectedOutputs?: string[];
  skills?: string[];
}

export async function addTaskCommand(studyId: string | undefined, options: AddTaskCommandOptions = {}): Promise<void> {
  if (!studyId) {
    throw new Error('Missing required argument <study-id>.');
  }

  const projectRoot = resolveProjectRoot();
  await requireQddProjectRoot(projectRoot);

  const result = await createTask(projectRoot, studyId, {
    goal: options.goal,
    dependsOn: options.dependsOn,
    inputs: options.inputs,
    expectedOutputs: options.expectedOutputs,
    skills: options.skills,
  });

  console.log(`Created task ${result.taskId} for ${result.studyId}`);
  console.log(`Path: ${result.relativePath}`);
}
