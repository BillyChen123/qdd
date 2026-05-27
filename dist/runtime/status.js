import { PATHS } from './constants.js';
import { discoverStudies, discoverTasks } from './discovery.js';
import { deriveStudyLifecycleState } from './lifecycle.js';
import { readYamlFile } from './store.js';
// 组装 `qdd status --json` 需要的统一状态视图。
//
// 你可以把它理解成“读模型聚合器”：
// - 一部分数据来自项目级 YAML（contract / evolution / artifacts）
// - 一部分数据来自磁盘扫描出来的 study/task 记录
// 最后把它们整理成一个稳定的 JSON 结构，给 CLI 或 agent 直接消费。
export async function buildStatus(projectRoot) {
    const contract = await readYamlFile(projectRoot, PATHS.contract);
    const evolution = await readYamlFile(projectRoot, PATHS.evolution);
    const artifactIndex = await readYamlFile(projectRoot, PATHS.artifactIndex);
    const studies = await discoverStudies(projectRoot);
    const tasks = await discoverTasks(projectRoot);
    // evolution_trail 的最后一条，代表最近一次问题演化。
    // 如果还没有演化记录，就回退到 contract 里的 initial_question。
    const lastEvolutionEntry = evolution.evolution_trail[evolution.evolution_trail.length - 1] ?? null;
    const lastDelta = lastEvolutionEntry?.question_delta ?? null;
    const currentQuestion = lastDelta?.question_after ?? contract.initial_question;
    return {
        project: {
            theme: contract.theme,
            mode: contract.mode,
            current_question: currentQuestion,
        },
        studies: {
            // active / closed 这里不是原样返回整个 study 对象，
            // 而是先做一层摘要，只暴露各状态下的 study_id 列表。
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
            // 任务状态同理：这里提供的是一个面向状态总览的轻量视图。
            pending: tasks.filter((task) => (task.status ?? 'pending') === 'pending').map((task) => task.task_id),
            running: tasks.filter((task) => task.status === 'running').map((task) => task.task_id),
            blocked: tasks.filter((task) => task.status === 'blocked').map((task) => task.task_id),
            completed: tasks.filter((task) => task.status === 'completed').map((task) => task.task_id),
        },
        artifacts: {
            // latest 只取最近 5 个产物 id，避免 status 输出越来越长。
            count: artifactIndex.artifacts.length,
            latest: artifactIndex.artifacts.slice(-5).map((entry) => entry.id),
        },
        question_state: {
            // 这里关心的是“问题现在怎么变过来、还有哪些开放边界未收束”。
            last_change_type: lastDelta?.change_type ?? null,
            open_boundaries: lastDelta?.open_boundaries ?? [],
        },
    };
}
//# sourceMappingURL=status.js.map