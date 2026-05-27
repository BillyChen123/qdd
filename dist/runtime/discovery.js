import path from 'node:path';
import * as nodeFs from 'node:fs';
import { parseYaml } from '../utils/yaml.js';
// Markdown frontmatter 的匹配规则。
// 例如一个 study.md / TASK-001.md 文件最前面如果是：
// ---
// study_id: STUDY-001
// question: ...
// ---
// 就会被这个正则提取出来，再交给 YAML 解析器。
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
// node:fs 的 promise 版本，方便直接配合 async/await 使用。
const fs = nodeFs.promises;
// 读取一个 YAML 文件；如果文件不存在，就返回 null。
// 这个模式适合“可选文件”：存在就读，不存在就当作空。
async function readYamlIfExists(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return parseYaml(content);
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}
// 读取一个 Markdown 文件开头的 frontmatter；如果文件不存在，返回 null。
// 注意：这里不是读取整篇 Markdown，只读取最上方 --- --- 之间的 YAML 区块。
// 如果文件存在，但没有 frontmatter，会直接报错，因为这说明记录格式不合法。
async function readFrontmatterIfExists(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const match = content.match(FRONTMATTER_PATTERN);
        if (!match) {
            throw new Error(`${filePath} is missing YAML frontmatter.`);
        }
        return parseYaml(match[1]);
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}
// 扫描 studies/ 目录，找到每个 study 子目录里的 study.md，
// 再从 frontmatter 中解析出 StudyRecord。
//
// 返回值是“当前项目里所有已存在的 study 记录”。
// 如果 studies/ 目录都还没有，就返回空数组，不报错。
export async function discoverStudies(projectRoot) {
    const studiesDir = path.join(projectRoot, 'studies');
    try {
        const entries = await fs.readdir(studiesDir, { withFileTypes: true });
        const studies = await Promise.all(entries
            .filter((entry) => entry.isDirectory())
            .map(async (entry) => {
            const studyPath = path.join(studiesDir, entry.name, 'study.md');
            return await readFrontmatterIfExists(studyPath);
        }));
        return studies.filter((study) => study !== null);
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}
// 扫描所有 studies/<studyId>/tasks/*.md，
// 从每个任务文件的 frontmatter 中解析出 TaskRecord。
//
// 这里做了两件额外的事：
// 1. 如果 frontmatter 里没写 study_id，就用它所在的目录名补上。
// 2. 如果 frontmatter 里没写 task_id，就用文件名（去掉 .md）补上。
//
// 这样可以让任务文件写法稍微宽松一点，但最终返回给 runtime 的任务数据仍然完整。
export async function discoverTasks(projectRoot) {
    const studiesDir = path.join(projectRoot, 'studies');
    const tasks = [];
    try {
        // 这里的核心约定是：任务记录的“结构化真相”放在 Markdown frontmatter 里。
        // Markdown 正文可以继续给人类/agent 写叙述内容，但机器读取的数据来自 frontmatter。
        const studyEntries = await fs.readdir(studiesDir, { withFileTypes: true });
        for (const studyEntry of studyEntries) {
            if (!studyEntry.isDirectory())
                continue;
            const tasksDir = path.join(studiesDir, studyEntry.name, 'tasks');
            let taskEntries = [];
            try {
                taskEntries = await fs.readdir(tasksDir, { withFileTypes: true });
            }
            catch (error) {
                if (error.code === 'ENOENT')
                    continue;
                throw error;
            }
            for (const taskEntry of taskEntries) {
                if (!taskEntry.isFile() || !taskEntry.name.endsWith('.md'))
                    continue;
                const taskPath = path.join(tasksDir, taskEntry.name);
                const task = await readFrontmatterIfExists(taskPath);
                if (task) {
                    tasks.push({
                        ...task,
                        study_id: task.study_id ?? studyEntry.name,
                        task_id: task.task_id ?? taskEntry.name.replace(/\.md$/, ''),
                    });
                }
            }
        }
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
    return tasks;
}
//# sourceMappingURL=discovery.js.map