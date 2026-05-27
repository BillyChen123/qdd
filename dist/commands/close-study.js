import { closeStudy } from '../runtime/lifecycle.js';
import { requireQddProjectRoot, resolveProjectRoot } from '../runtime/paths.js';
export async function closeStudyCommand(studyId, options = {}) {
    if (!studyId) {
        throw new Error('Missing required argument <study-id>.');
    }
    if (!options.questionAfter) {
        throw new Error('Missing required option --question-after <text>.');
    }
    if (!options.changeType) {
        throw new Error('Missing required option --change-type <refinement|confirmation|pivot|dissolution>.');
    }
    if (!options.changeDriver) {
        throw new Error('Missing required option --change-driver <text>.');
    }
    const projectRoot = resolveProjectRoot();
    await requireQddProjectRoot(projectRoot);
    await closeStudy(projectRoot, studyId, {
        questionAfter: options.questionAfter,
        changeType: options.changeType,
        changeDriver: options.changeDriver,
        openBoundaries: options.openBoundaries ?? [],
    });
    console.log(`Closed study ${studyId}`);
}
//# sourceMappingURL=close-study.js.map