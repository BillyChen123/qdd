import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { natureTemplateRoot, validateManuscriptPackage } from '../services/manuscript-package.js';
async function createPackage() {
    const packageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-manuscript-package-'));
    const templateRoot = natureTemplateRoot();
    await fs.mkdir(path.join(packageDir, 'bst'), { recursive: true });
    await fs.mkdir(path.join(packageDir, 'figures'), { recursive: true });
    await Promise.all([
        fs.copyFile(path.join(templateRoot, 'sn-jnl.cls'), path.join(packageDir, 'sn-jnl.cls')),
        fs.copyFile(path.join(templateRoot, 'latexmkrc'), path.join(packageDir, 'latexmkrc')),
        fs.copyFile(path.join(templateRoot, 'bst', 'sn-nature.bst'), path.join(packageDir, 'bst', 'sn-nature.bst')),
        fs.writeFile(path.join(packageDir, 'figures', 'figure-1.png'), 'placeholder asset'),
        fs.writeFile(path.join(packageDir, 'references.bib'), '@article{source2024, author={Source, S.}, title={Verified support}, journal={Journal}, year={2024}}\n'),
        fs.writeFile(path.join(packageDir, 'main.tex'), String.raw `\documentclass[pdflatex,sn-nature]{sn-jnl}
\usepackage{graphicx}
\graphicspath{{figures/}}
\begin{document}
\title{A source-grounded manuscript}
\abstract{An abstract with a verified citation-free summary.}
\keywords{Parkinson's disease, transcript usage}
\maketitle
\section{Introduction}\label{sec:introduction}
Background is supported by \cite{source2024}.
\section{Results}\label{sec:results}
The selected evidence is shown in Fig.~\ref{fig:one}.
\section{Discussion}\label{sec:discussion}
The interpretation remains evidence-proportionate.
\section{Methods}\label{sec:methods}
Methods are limited to documented procedures.
\bibliography{references}
\begin{figure}[p]
\centering
\includegraphics[width=\linewidth]{figures/figure-1.png}
\caption{A source-supported figure caption.}
\label{fig:one}
\end{figure}
\end{document}
`),
    ]);
    return packageDir;
}
test('mechanically validates an agent-authored Nature package without rendering prose', async () => {
    const packageDir = await createPackage();
    const report = await validateManuscriptPackage(packageDir, null);
    assert.equal(report.pdf_status, 'unavailable');
    assert.deepEqual(report.citations, ['source2024']);
    assert.deepEqual(report.bibliography_entries, ['source2024']);
    assert.deepEqual(report.references, ['fig:one']);
    assert.equal(report.figures.length, 1);
    assert.ok(Object.values(report.checks).every((status) => status === 'passed'));
    await fs.access(path.join(packageDir, 'manuscript-validation.json'));
});
test('accepts a nonempty unnumbered Abstract section in an otherwise compliant Nature package', async () => {
    const packageDir = await createPackage();
    const mainTex = path.join(packageDir, 'main.tex');
    const tex = await fs.readFile(mainTex, 'utf-8');
    await fs.writeFile(mainTex, tex.replace('\\abstract{An abstract with a verified citation-free summary.}', '\\section*{Abstract}\nAn abstract with a verified citation-free summary.'));
    const report = await validateManuscriptPackage(packageDir, null);
    assert.equal(report.checks.tex_structure, 'passed');
});
test('rejects placeholders and floats before the bibliography', async () => {
    const packageDir = await createPackage();
    const mainTex = path.join(packageDir, 'main.tex');
    const tex = await fs.readFile(mainTex, 'utf-8');
    await fs.writeFile(mainTex, tex.replace('The interpretation remains evidence-proportionate.', 'TODO: revise discussion.'));
    await assert.rejects(validateManuscriptPackage(packageDir, null), /drafting placeholder/);
    await fs.writeFile(mainTex, tex
        .replace('\\bibliography{references}\n\\begin{figure}', '\\begin{figure}')
        .replace('\\end{figure}\n\\end{document}', '\\end{figure}\n\\bibliography{references}\n\\end{document}'));
    await assert.rejects(validateManuscriptPackage(packageDir, null), /figures and tables must follow/);
});
test('rejects unresolved or incomplete BibTeX entries', async () => {
    const packageDir = await createPackage();
    const bibliography = path.join(packageDir, 'references.bib');
    await fs.writeFile(bibliography, '@article{source2024, author={}, title={Verified support}, journal={Journal}, year={2024}, note={PMID pending verification}}\n');
    await assert.rejects(validateManuscriptPackage(packageDir, null), /unresolved or incomplete entry/);
});
//# sourceMappingURL=manuscript-package.test.js.map