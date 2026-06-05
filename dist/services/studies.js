import path from 'node:path';
import { renderStudyBody } from '../file-contracts/study.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from '../runtime/constants.js';
import { discoverStudies } from '../runtime/discovery.js';
import { ensureStudyOutputLayout } from '../runtime/evidence.js';
import { readMarkdownDocument, writeMarkdownDocument } from '../runtime/store.js';
const STUDY_ID_PATTERN = /^STUDY-(\d{3})$/;
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
async function nextStudyId(projectRoot) {
    const studies = await discoverStudies(projectRoot);
    return formatSequentialId('STUDY', getHighestMatchingIndex(studies.map((study) => study.study_id), STUDY_ID_PATTERN) + 1);
}
export async function readStudyDocument(projectRoot, studyId) {
    const relativePath = `${PATHS.studiesDir}/${studyId}/study.md`;
    const document = await readMarkdownDocument(projectRoot, relativePath);
    return {
        relativePath,
        record: {
            ...document.frontmatter,
            study_id: document.frontmatter.study_id ?? studyId,
            target_boundaries: document.frontmatter.target_boundaries ?? [],
            task_ids: document.frontmatter.task_ids ?? [],
            blockers: document.frontmatter.blockers ?? [],
            expected_artifacts: document.frontmatter.expected_artifacts ?? [],
        },
        body: document.body,
    };
}
// 创建 study 只负责落一个最小但完整的 study scaffold。
// 真正的 task 图由后续 qdd-propose / qdd add-task 补上。
export async function createStudy(projectRoot, options = {}) {
    const studyId = await nextStudyId(projectRoot);
    const studyDir = `${PATHS.studiesDir}/${studyId}`;
    const record = {
        study_id: studyId,
        question: options.question?.trim() || 'Unspecified study question',
        hypothesis: options.hypothesis?.trim() || 'Unspecified hypothesis',
        target_boundaries: options.targetBoundaries ?? [],
        status: 'created',
        task_ids: [],
        blockers: options.blockers ?? [],
        expected_artifacts: options.expectedArtifacts ?? [],
    };
    await FileSystemUtils.createDirectory(path.join(projectRoot, studyDir, 'tasks'));
    await ensureStudyOutputLayout(projectRoot, studyId);
    await writeMarkdownDocument(projectRoot, `${studyDir}/study.md`, record, renderStudyBody(record));
    return {
        studyId,
        relativePath: `${studyDir}/study.md`,
    };
}
//# sourceMappingURL=studies.js.map