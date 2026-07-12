import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { renderAcceptedStory } from '../services/story-tex.js';
const execFileAsync = promisify(execFile);
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(moduleDir, '..', '..');
const fixtureSource = path.join(packageRoot, 'src', 'test', 'fixtures', 'conclude');
async function createRenderingProject() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-story-tex-'));
    await fs.cp(path.join(fixtureSource, 'accepted-story'), path.join(root, 'accepted-story'), { recursive: true });
    const sourceFigure = path.join(fixtureSource, 'sdk-two-gate', 'studies', 'STUDY-002', 'output', 'figures', 'regional-response.ppm');
    const targetFigure = path.join(root, 'sdk-two-gate', 'studies', 'STUDY-002', 'output', 'figures', 'regional-response.ppm');
    await fs.mkdir(path.dirname(targetFigure), { recursive: true });
    await fs.copyFile(sourceFigure, targetFigure);
    return root;
}
test('accepted story renders faithfully to TeX, cited BibTeX, figures, tables, refs, and unavailable PDF status', async () => {
    const projectRoot = await createRenderingProject();
    const report = await renderAcceptedStory({
        projectRoot,
        storyPath: 'accepted-story/story.md',
        bibliographyPath: 'accepted-story/verified-references.bib',
        gate2Accepted: true,
        texCompiler: null,
    });
    assert.equal(report.pdf_status, 'unavailable');
    assert.equal(report.pdf_path, null);
    assert.equal(report.coverage.ratio, 1);
    assert.equal(report.coverage.story_blocks, report.coverage.rendered_blocks);
    assert.deepEqual(report.section_order, [
        'Regional β Response & Immune-Niche Organization',
        'Abstract', 'Introduction', 'Results', 'Quantitative summary', 'Discussion', 'Methods',
    ]);
    assert.deepEqual(report.citations, ['doe2024', 'roe2023']);
    assert.deepEqual(report.bibliography_entries, ['doe2024', 'roe2023']);
    assert.deepEqual(report.references, ['fig:regional', 'tbl:response']);
    assert.equal(report.figures[0]?.source.endsWith('regional-response.ppm'), true);
    assert.equal(report.figures[0]?.output, 'figures/fig-regional.png');
    const outputDir = path.join(projectRoot, 'accepted-story', 'final_paper');
    const tex = await fs.readFile(path.join(outputDir, 'main.tex'), 'utf-8');
    const bibtex = await fs.readFile(path.join(outputDir, 'references.bib'), 'utf-8');
    const png = await fs.readFile(path.join(outputDir, 'figures', 'fig-regional.png'));
    const persistedReport = JSON.parse(await fs.readFile(path.join(outputDir, 'render-report.json'), 'utf-8'));
    assert.match(tex, /\\title\{Regional \\ensuremath\{\\beta\} Response \\& Immune-Niche Organization\}/);
    assert.match(tex, /\\begin\{abstract\}/);
    assert.match(tex, /\$x_i \\leq 1\$/);
    assert.match(tex, /25\\% threshold/);
    assert.match(tex, /\\texttt\{response\\_rate\}/);
    assert.match(tex, /cohort\\_A/);
    assert.match(tex, /\\includegraphics\[width=\\linewidth\]\{figures\/fig-regional\.png\}/);
    assert.match(tex, /Figure~\\ref\{fig:regional\}/);
    assert.match(tex, /Table~\\ref\{tbl:response\}/);
    assert.match(tex, /\\cite\{doe2024\}/);
    assert.match(tex, /\\cite\{doe2024,roe2023\}/);
    assert.match(tex, /\\begin\{tabular\}\{lrrr\}/);
    assert.match(tex, /\\resizebox\{\\textwidth\}\{!\}/);
    assert.doesNotMatch(bibtex, /unused2022/);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(persistedReport.story_sha256, report.story_sha256);
    for (const block of report.coverage.blocks) {
        assert.match(tex, new RegExp(`qdd-story-block:${block.index} type:${block.type} sha256:${block.sha256}`));
    }
});
test('renderer refuses unresolved Gate 2 without creating final_paper', async () => {
    const projectRoot = await createRenderingProject();
    await assert.rejects(renderAcceptedStory({ projectRoot, storyPath: 'accepted-story/story.md', gate2Accepted: false, texCompiler: null }), /Gate 2 acceptance is required/);
    await assert.rejects(fs.access(path.join(projectRoot, 'accepted-story', 'final_paper')));
});
test('renderer preflight rejects missing assets, broken refs, and missing citation keys without partial output', async (t) => {
    await t.test('missing figure asset', async () => {
        const projectRoot = await createRenderingProject();
        const storyPath = path.join(projectRoot, 'accepted-story', 'story.md');
        const story = await fs.readFile(storyPath, 'utf-8');
        await fs.writeFile(storyPath, story.replace('regional-response.ppm', 'missing.png'), 'utf-8');
        await assert.rejects(renderAcceptedStory({
            projectRoot, storyPath: 'accepted-story/story.md', bibliographyPath: 'accepted-story/verified-references.bib',
            gate2Accepted: true, texCompiler: null,
        }), /Missing figure asset/);
        await assert.rejects(fs.access(path.join(projectRoot, 'accepted-story', 'final_paper')));
    });
    await t.test('broken story reference', async () => {
        const projectRoot = await createRenderingProject();
        const storyPath = path.join(projectRoot, 'accepted-story', 'story.md');
        const story = await fs.readFile(storyPath, 'utf-8');
        await fs.writeFile(storyPath, story.replace('@tbl:response', '@tbl:missing'), 'utf-8');
        await assert.rejects(renderAcceptedStory({
            projectRoot, storyPath: 'accepted-story/story.md', bibliographyPath: 'accepted-story/verified-references.bib',
            gate2Accepted: true, texCompiler: null,
        }), /Broken story cross-reference/);
    });
    await t.test('missing verified citation', async () => {
        const projectRoot = await createRenderingProject();
        const bibliographyPath = path.join(projectRoot, 'accepted-story', 'verified-references.bib');
        const bibliography = await fs.readFile(bibliographyPath, 'utf-8');
        await fs.writeFile(bibliographyPath, bibliography.replace(/@article\{roe2023,[\s\S]*?\n\}\n\n/, ''), 'utf-8');
        await assert.rejects(renderAcceptedStory({
            projectRoot, storyPath: 'accepted-story/story.md', bibliographyPath: 'accepted-story/verified-references.bib',
            gate2Accepted: true, texCompiler: null,
        }), /Missing verified BibTeX entries.*roe2023/);
    });
    await t.test('malformed BibTeX', async () => {
        const projectRoot = await createRenderingProject();
        await fs.writeFile(path.join(projectRoot, 'accepted-story', 'verified-references.bib'), '@article{broken, title={Unclosed}\n', 'utf-8');
        await assert.rejects(renderAcceptedStory({
            projectRoot, storyPath: 'accepted-story/story.md', bibliographyPath: 'accepted-story/verified-references.bib',
            gate2Accepted: true, texCompiler: null,
        }), /Malformed BibTeX/);
    });
    await t.test('duplicate BibTeX key', async () => {
        const projectRoot = await createRenderingProject();
        const bibliographyPath = path.join(projectRoot, 'accepted-story', 'verified-references.bib');
        await fs.appendFile(bibliographyPath, '\n@article{doe2024, title={Duplicate}, year={2024}}\n', 'utf-8');
        await assert.rejects(renderAcceptedStory({
            projectRoot, storyPath: 'accepted-story/story.md', bibliographyPath: 'accepted-story/verified-references.bib',
            gate2Accepted: true, texCompiler: null,
        }), /Duplicate BibTeX keys.*doe2024/);
    });
});
test('committed accepted-story fixture renders through the focused CLI', async () => {
    const projectRoot = await createRenderingProject();
    const qddBin = path.join(packageRoot, 'bin', 'qdd.js');
    const { stdout } = await execFileAsync(process.execPath, [
        qddBin, 'render-story', 'accepted-story/story.md', '--gate2-accepted',
        '--bibliography', 'accepted-story/verified-references.bib', '--json',
    ], { cwd: projectRoot, timeout: 120_000 });
    const report = JSON.parse(stdout);
    assert.ok(report.pdf_status === 'compiled' || report.pdf_status === 'unavailable');
    assert.equal(report.coverage.ratio, 1);
    assert.ok(Object.values(report.checks).every((status) => status === 'passed'));
});
//# sourceMappingURL=story-tex.test.js.map