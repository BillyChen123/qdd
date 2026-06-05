import path from 'node:path';
import * as nodeFs from 'node:fs/promises';
import { replaceMarkdownSection } from '../file-contracts/shared.js';
import { renderTaskBody } from '../file-contracts/task.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from '../runtime/constants.js';
import { discoverTasks } from '../runtime/discovery.js';
import { normalizeTaskSkillIds, resolveLocalSkills } from '../runtime/local-skills.js';
import { readMarkdownDocument, writeMarkdownDocument } from '../runtime/store.js';
import { readStudyDocument } from './studies.js';
const TASK_ID_PATTERN = /^TASK-(\d{3})$/;
function formatSequentialId(prefix, index) {
    return `${prefix}-${String(index).padStart(3, '0')}`;
}
function getHighestMatchingIndex(values, pattern) {
    return values.reduce((highest, value) => {
        const match = value.match(pattern);
        if (!match) {
            return highest;
        }
        return Math.max(highest, Number.parseInt(match[1], 10));
    }, 0);
}
async function nextTaskId(projectRoot) {
    const tasks = await discoverTasks(projectRoot);
    return formatSequentialId('TASK', getHighestMatchingIndex(tasks.map((task) => task.task_id), TASK_ID_PATTERN) + 1);
}
// 通过“已知路径 + 预期 ID”读取 task 文档。
// 这里会把缺失的关键 frontmatter 字段用路径信息补齐，
// 保证后续 runtime 在面对半成品文档时仍有稳定视图。
export async function readTaskDocumentByPath(projectRoot, relativePath, studyId, taskId) {
    const document = await readMarkdownDocument(projectRoot, relativePath);
    return {
        relativePath,
        record: {
            ...document.frontmatter,
            task_id: document.frontmatter.task_id ?? taskId,
            study_id: document.frontmatter.study_id ?? studyId,
            expected_outputs: document.frontmatter.expected_outputs ?? [],
            depends_on: document.frontmatter.depends_on ?? [],
            skills: document.frontmatter.skills ?? [],
            artifact_ids: document.frontmatter.artifact_ids ?? [],
        },
        body: document.body,
    };
}
// 反查一个 task 属于哪个 study。
// 这在 register-artifact / instructions / closeStudy 里都很关键，
// 因为 task 本身的 CLI 输入通常只带 TASK-XXX，不带父 studyId。
export async function findTaskDocument(projectRoot, taskId) {
    const studiesDir = path.join(projectRoot, PATHS.studiesDir);
    const studyEntries = await FileSystemUtils.directoryExists(studiesDir)
        ? await nodeFs.readdir(studiesDir, { withFileTypes: true })
        : [];
    for (const studyEntry of studyEntries) {
        if (!studyEntry.isDirectory()) {
            continue;
        }
        const relativePath = `${PATHS.studiesDir}/${studyEntry.name}/tasks/${taskId}.md`;
        const absolutePath = path.join(projectRoot, relativePath);
        if (!(await FileSystemUtils.fileExists(absolutePath))) {
            continue;
        }
        const document = await readTaskDocumentByPath(projectRoot, relativePath, studyEntry.name, taskId);
        return {
            studyId: studyEntry.name,
            ...document,
        };
    }
    throw new Error(`Task '${taskId}' not found.`);
}
// 创建 task 时会立即校验 skills 是否真实存在于 central domain-skills/ 下。
// 这样 task 记录本身就是“可执行约束”，而不是任意文本。
export async function createTask(projectRoot, studyId, options = {}) {
    const study = await readStudyDocument(projectRoot, studyId);
    const taskId = await nextTaskId(projectRoot);
    const relativePath = `${PATHS.studiesDir}/${studyId}/tasks/${taskId}.md`;
    const normalizedSkills = normalizeTaskSkillIds(options.skills);
    const resolvedSkills = await resolveLocalSkills(projectRoot, normalizedSkills);
    if (resolvedSkills.disallowedWorkflow.length > 0) {
        throw new Error(`Task skills must not include workflow skills: ${resolvedSkills.disallowedWorkflow.join(', ')}. Use concrete domain skills instead.`);
    }
    if (resolvedSkills.planningOnly.length > 0) {
        throw new Error(`Task skills must not include planning-only brain skills: ${resolvedSkills.planningOnly.join(', ')}. Move them to study planning and keep task skills executor-facing.`);
    }
    if (resolvedSkills.missing.length > 0) {
        throw new Error(`Task skills must already exist under the QDD root domain-skills/ library before they are referenced: ${resolvedSkills.missing.join(', ')}.`);
    }
    const taskRecord = {
        task_id: taskId,
        study_id: studyId,
        goal: options.goal?.trim() || 'Unspecified task goal',
        status: 'pending',
        expected_outputs: options.expectedOutputs ?? [],
        depends_on: options.dependsOn ?? [],
        skills: normalizedSkills,
        promotion_status: 'pending',
        artifact_ids: [],
        updated_at: new Date().toISOString(),
    };
    await writeMarkdownDocument(projectRoot, relativePath, taskRecord, renderTaskBody(taskRecord, studyId, options.inputs ?? []));
    const updatedStudyRecord = {
        ...study.record,
        task_ids: [...(study.record.task_ids ?? []), taskId],
    };
    const updatedTaskIds = updatedStudyRecord.task_ids ?? [];
    const updatedTasksSection = updatedTaskIds
        .map((linkedTaskId) => {
        if (linkedTaskId === taskId) {
            return `- [ ] ${taskId}: ${taskRecord.goal}`;
        }
        return `- [ ] ${linkedTaskId}`;
    })
        .join('\n');
    const updatedStudyBody = replaceMarkdownSection(study.body, 'Tasks', updatedTasksSection);
    await writeMarkdownDocument(projectRoot, study.relativePath, updatedStudyRecord, updatedStudyBody);
    return {
        studyId,
        taskId,
        relativePath,
    };
}
//# sourceMappingURL=tasks.js.map