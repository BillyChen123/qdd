import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs/promises';
import { initCommand } from '../commands/init.js';
import { CONCLUDE_EVIDENCE_READ_LIMITS } from '../services/conclude-evidence.js';
import { generateConcludeStoryCandidates } from '../services/conclude.js';
import { loadConcludeEvalOracle } from '../services/conclude-eval-oracle.js';
import { recordArtifactCandidate, registerArtifact } from '../services/artifacts.js';
import { createStudy } from '../services/studies.js';
import { createTask } from '../services/tasks.js';
import { readMarkdownDocument, writeMarkdownDocument } from '../runtime/store.js';
async function createTempProject() {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-conclude-dossier-'));
    await initCommand(projectRoot, { tools: ['claude'] });
    return projectRoot;
}
async function markRecordsCompleted(projectRoot, studyId, taskId) {
    const studyPath = `studies/${studyId}/study.md`;
    const study = await readMarkdownDocument(projectRoot, studyPath);
    await writeMarkdownDocument(projectRoot, studyPath, {
        ...study.frontmatter,
        status: 'completed',
        summary: 'Reusable for filtering; loads, extracts, and exports intermediate assets.',
    }, study.body);
    const taskPath = `studies/${studyId}/tasks/${taskId}.md`;
    const task = await readMarkdownDocument(projectRoot, taskPath);
    await writeMarkdownDocument(projectRoot, taskPath, {
        ...task.frontmatter,
        status: 'completed',
        result_summary: 'Useful for filtering; loads and exports reusable artifact data.',
    }, task.body);
}
function parseOracleSupport(value) {
    const match = value.match(/^(\S+)\s+log2FC=([^,]+),\s+FDR=(\S+)$/);
    assert.ok(match, `Unexpected oracle support format: ${value}`);
    return { gene: match[1], log2fc: match[2], fdr: match[3] };
}
function makePngHeader(width, height) {
    const buffer = Buffer.alloc(24);
    buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    buffer.write('IHDR', 12, 'ascii');
    buffer.writeUInt32BE(width, 16);
    buffer.writeUInt32BE(height, 20);
    return buffer;
}
test('conclude builds a source-aware dossier with verifiable Parkinson claims and deduplicated assets', async () => {
    const projectRoot = await createTempProject();
    const { oracle } = await loadConcludeEvalOracle();
    const stateAxis = oracle.expectedFacts.find((fact) => fact.id === 'state-axis');
    assert.ok(stateAxis);
    assert.ok(oracle.requiredManuscriptSignals.some((signal) => /figure or table anchors/i.test(signal)));
    const supports = stateAxis.support.map(parseOracleSupport);
    const study = await createStudy(projectRoot, {
        question: 'Which astrocyte state carries the splicing-factor signal?',
        hypothesis: 'The protective-like state is associated with higher QKI and CELF2 expression.',
        expectedArtifacts: ['A table, report, and figure'],
    });
    const task = await createTask(projectRoot, study.studyId, {
        goal: 'Export the astrocyte state comparison',
        expectedOutputs: ['A source table and figure'],
    });
    await markRecordsCompleted(projectRoot, study.studyId, task.taskId);
    const tablePath = path.join(projectRoot, 'studies', study.studyId, 'output', 'tables', 'state-axis.csv');
    const tableContent = [
        'gene_symbol,subcluster,log2FC,fdr_qvalue,significant,direction',
        ...supports.map((support) => `${support.gene},17,${support.log2fc},${support.fdr},True,up`),
    ].join('\n') + '\n';
    await fs.writeFile(tablePath, tableContent, 'utf-8');
    await recordArtifactCandidate(projectRoot, tablePath, {
        studyId: study.studyId,
        taskId: task.taskId,
        artifactType: 'table',
        description: 'Reusable for filtering; loads, extracts, and exports the astrocyte state table.',
        schema: 'csv-table',
    });
    const registeredTable = await registerArtifact(projectRoot, tablePath, {
        studyId: study.studyId,
        taskId: task.taskId,
        artifactType: 'table',
        description: 'Reusable for filtering; loads, extracts, and exports the astrocyte state table.',
        reusable: true,
        schema: 'csv-table',
    });
    const reportPath = path.join(projectRoot, 'studies', study.studyId, 'output', 'reports', 'state-axis.md');
    await fs.writeFile(reportPath, [
        '# Astrocyte state assessment',
        '',
        '## Results',
        '',
        'Within substantia nigra astrocytes, QKI and CELF2 were higher in cluster 17 than in the reference state.',
        '',
        '## Limitations',
        '',
        'The association does not support a claim that either splicing factor caused the state transition.',
        '',
        '## Output Files',
        '',
        'This artifact loads and exports reusable files for downstream filtering.',
        '',
    ].join('\n'), 'utf-8');
    await recordArtifactCandidate(projectRoot, reportPath, {
        studyId: study.studyId,
        taskId: task.taskId,
        artifactType: 'report',
        description: 'Astrocyte state result and its causal boundary.',
        schema: 'markdown-report',
    });
    await registerArtifact(projectRoot, reportPath, {
        studyId: study.studyId,
        taskId: task.taskId,
        artifactType: 'report',
        description: 'Astrocyte state result and its causal boundary.',
        reusable: true,
        schema: 'markdown-report',
    });
    const figurePath = path.join(projectRoot, 'studies', study.studyId, 'output', 'figures', 'astrocyte-sf-umap.png');
    await fs.writeFile(figurePath, makePngHeader(1200, 900));
    await recordArtifactCandidate(projectRoot, figurePath, {
        studyId: study.studyId,
        taskId: task.taskId,
        artifactType: 'figure',
        description: 'UMAP of substantia nigra astrocytes colored by QKI and CELF2 expression.',
        schema: 'png-figure',
    });
    await registerArtifact(projectRoot, figurePath, {
        studyId: study.studyId,
        taskId: task.taskId,
        artifactType: 'figure',
        description: 'UMAP of substantia nigra astrocytes colored by QKI and CELF2 expression.',
        reusable: true,
        schema: 'png-figure',
    });
    const largeTablePath = path.join(projectRoot, 'studies', study.studyId, 'output', 'tables', 'bounded-large.csv');
    const repeatedRow = 'GENE,17,1.0,0.01,True,up\n';
    const largeContent = 'gene_symbol,subcluster,log2FC,fdr_qvalue,significant,direction\n'
        + repeatedRow.repeat(Math.ceil(CONCLUDE_EVIDENCE_READ_LIMITS.maxBytesPerTextSource / repeatedRow.length) + 100);
    await fs.writeFile(largeTablePath, largeContent, 'utf-8');
    await recordArtifactCandidate(projectRoot, largeTablePath, {
        studyId: study.studyId,
        taskId: task.taskId,
        artifactType: 'table',
        description: 'Large bounded-reader regression table.',
        schema: 'csv-table',
    });
    const result = await generateConcludeStoryCandidates(projectRoot, {
        outputDir: 'conclusions/dossier-test',
        now: new Date('2026-07-10T08:00:00.000Z'),
    });
    const dossier = result.evidenceDossier;
    const resultStatements = dossier.evidenceUnits
        .filter((unit) => unit.eligibility === 'results')
        .map((unit) => unit.narrative.scientificStatement ?? '');
    assert.equal(dossier.schemaVersion, 1);
    assert.equal(dossier.kind, 'qdd-manuscript-evidence-dossier');
    assert.equal(dossier.audit.status, 'pass');
    assert.equal(dossier.summary.uniqueSources, 4);
    assert.ok(resultStatements.some((statement) => /QKI.*log2fc=1\.24/i.test(statement)));
    assert.ok(resultStatements.some((statement) => /CELF2.*log2fc=1\.40/i.test(statement)));
    assert.ok(dossier.evidenceUnits.some((unit) => unit.eligibility === 'boundary' && /does not support/i.test(unit.narrative.scientificStatement ?? '')));
    assert.ok(resultStatements.every((statement) => !/Reusable for|Useful for filtering|loads|extracts|exports/i.test(statement)));
    assert.ok(dossier.evidenceUnits
        .filter((unit) => unit.eligibility === 'results')
        .every((unit) => unit.provenance.sources.every((source) => source.sourceType === 'artifact-content')));
    const qkiUnit = dossier.evidenceUnits.find((unit) => /QKI.*log2fc=1\.24/i.test(unit.narrative.scientificStatement ?? ''));
    assert.ok(qkiUnit);
    const tableLocator = qkiUnit.provenance.sources[0]?.locator;
    assert.equal(tableLocator?.kind, 'table-row');
    const locator = tableLocator;
    const resolvedSource = path.join(projectRoot, locator.path);
    const sourceLines = (await fs.readFile(resolvedSource, 'utf-8')).trimEnd().split(/\r?\n/);
    const headers = sourceLines[0].split(',');
    const locatedValues = sourceLines[locator.row - 1].split(',');
    const effectIndex = headers.indexOf(qkiUnit.narrative.effect.name);
    assert.ok(effectIndex >= 0);
    assert.equal(locatedValues[effectIndex], qkiUnit.narrative.effect.value);
    assert.equal(qkiUnit.provenance.sources[0].artifactIds[0], registeredTable.artifactId);
    assert.deepEqual(qkiUnit.provenance.sources[0].registrations.sort(), ['artifact-candidate', 'artifact-index']);
    const linkedAssets = dossier.assetCandidates.filter((asset) => qkiUnit.assetCandidateIds.includes(asset.id));
    assert.ok(linkedAssets.some((asset) => asset.kind === 'table'));
    assert.ok(linkedAssets.some((asset) => asset.kind === 'figure' && asset.width === 1200 && asset.height === 900));
    const boundedUnit = dossier.evidenceUnits.find((unit) => unit.provenance.sources.some((source) => source.locator.path.endsWith('bounded-large.csv')));
    assert.ok(boundedUnit);
    assert.equal(boundedUnit.provenance.extraction.bytesRead, CONCLUDE_EVIDENCE_READ_LIMITS.maxBytesPerTextSource);
    assert.equal(boundedUnit.provenance.extraction.truncated, true);
    assert.ok(dossier.evidenceUnits.filter((unit) => unit.provenance.sources.some((source) => source.locator.path.endsWith('bounded-large.csv'))).length <= CONCLUDE_EVIDENCE_READ_LIMITS.maxEvidenceUnitsPerSource);
    const json = JSON.parse(await fs.readFile(result.evidenceDossierJsonPath, 'utf-8'));
    const markdown = await fs.readFile(result.evidenceDossierMarkdownPath, 'utf-8');
    assert.equal(json.schemaVersion, 1);
    assert.equal(json.audit.status, 'pass');
    assert.match(markdown, /# Evidence Dossier/);
    assert.match(markdown, /#### Provenance/);
    assert.doesNotMatch(markdown.split('## Manuscript Evidence')[1].split('#### Provenance')[0], /ART-\d{3}|STUDY-\d{3}|TASK-\d{3}/);
});
//# sourceMappingURL=conclude-evidence.test.js.map