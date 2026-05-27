import { createTask } from '../runtime/lifecycle.js';
import { requireQddProjectRoot, resolveProjectRoot } from '../runtime/paths.js';
export async function addTaskCommand(studyId, options = {}) {
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
//# sourceMappingURL=add-task.js.map