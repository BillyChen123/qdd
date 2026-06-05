import { validateProject } from '../services/inspection.js';
import { requireQddProjectRoot, resolveProjectRoot } from '../runtime/paths.js';
export async function validateCommand(options = {}) {
    const projectRoot = resolveProjectRoot();
    await requireQddProjectRoot(projectRoot);
    const result = await validateProject(projectRoot);
    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    console.log(result.valid ? 'Validation: OK' : 'Validation: FAILED');
    if (result.issues.length === 0) {
        console.log('No validation issues found.');
        return;
    }
    for (const issue of result.issues) {
        console.log(`[${issue.level}] ${issue.path}: ${issue.message}`);
    }
}
//# sourceMappingURL=validate.js.map