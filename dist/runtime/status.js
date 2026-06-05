import { PATHS } from './constants.js';
import { discoverStudies, discoverTasks } from './discovery.js';
import { listNonCanonicalStudyOutputEntries } from './evidence.js';
import { listRecentStudyMemoryPaths, readEvolutionState, summarizeEvolutionBoundaries, getCurrentProjectQuestion } from './evolution.js';
import { deriveStudyLifecycleState } from './lifecycle.js';
import { readYamlFile } from './store.js';
// 组装 `qdd status --json` 的统一项目状态视图。
// 这里明确只读取当前协议里的真相源：
// - contract.yaml
// - evolution.yaml
// - studies/tasks 扫描结果
// - artifacts/index.yaml
// - context/memory/*.md
export async function buildStatus(projectRoot) {
    const contract = await readYamlFile(projectRoot, PATHS.contract);
    const evolution = await readEvolutionState(projectRoot);
    const artifactIndex = await readYamlFile(projectRoot, PATHS.artifactIndex);
    const studies = await discoverStudies(projectRoot);
    const tasks = await discoverTasks(projectRoot);
    const memoryPaths = await listRecentStudyMemoryPaths(projectRoot);
    const boundarySummary = summarizeEvolutionBoundaries(evolution);
    const currentQuestion = getCurrentProjectQuestion(contract, evolution);
    const lastStudy = evolution.studies.at(-1) ?? null;
    const studiesWithUnpackagedOutput = (await Promise.all(studies.map(async (study) => ({
        studyId: study.study_id,
        unpackaged: await listNonCanonicalStudyOutputEntries(projectRoot, study.study_id),
    }))))
        .filter((entry) => entry.unpackaged.length > 0)
        .map((entry) => entry.studyId);
    return {
        project: {
            theme: contract.theme,
            mode: contract.mode,
            current_question: currentQuestion,
        },
        studies: {
            active: studies
                .filter((study) => {
                const state = deriveStudyLifecycleState(study, tasks.filter((task) => task.study_id === study.study_id || (study.task_ids ?? []).includes(task.task_id)));
                return state !== 'closed' && state !== 'blocked' && state !== 'completed';
            })
                .map((study) => study.study_id),
            blocked: studies
                .filter((study) => {
                const state = deriveStudyLifecycleState(study, tasks.filter((task) => task.study_id === study.study_id || (study.task_ids ?? []).includes(task.task_id)));
                return state === 'blocked';
            })
                .map((study) => study.study_id),
            completed: studies
                .filter((study) => {
                const state = deriveStudyLifecycleState(study, tasks.filter((task) => task.study_id === study.study_id || (study.task_ids ?? []).includes(task.task_id)));
                return state === 'completed';
            })
                .map((study) => study.study_id),
            closed: studies
                .filter((study) => deriveStudyLifecycleState(study, tasks.filter((task) => task.study_id === study.study_id || (study.task_ids ?? []).includes(task.task_id))) === 'closed')
                .map((study) => study.study_id),
        },
        tasks: {
            pending: tasks.filter((task) => (task.status ?? 'pending') === 'pending').map((task) => task.task_id),
            running: tasks.filter((task) => task.status === 'running').map((task) => task.task_id),
            blocked: tasks.filter((task) => task.status === 'blocked').map((task) => task.task_id),
            completed: tasks.filter((task) => task.status === 'completed').map((task) => task.task_id),
            promotion_pending: tasks
                .filter((task) => task.status === 'completed' && (task.promotion_status ?? 'pending') === 'pending')
                .map((task) => task.task_id),
            candidate_recorded: tasks.filter((task) => task.promotion_status === 'candidate-recorded').map((task) => task.task_id),
            registered: tasks.filter((task) => task.promotion_status === 'registered').map((task) => task.task_id),
        },
        output_review: {
            studies_with_unpackaged_output: studiesWithUnpackagedOutput,
        },
        artifacts: {
            count: artifactIndex.artifacts.length,
            latest: artifactIndex.artifacts.slice(-5).map((entry) => entry.id),
        },
        memory: {
            recent: memoryPaths,
        },
        boundaries: boundarySummary,
        question_state: {
            last_kind: lastStudy?.kind ?? null,
            next_candidates: lastStudy?.candidates ?? [],
            open_boundary_ids: evolution.boundaries.filter((boundary) => boundary.state === 'open').map((boundary) => boundary.id),
        },
    };
}
//# sourceMappingURL=status.js.map