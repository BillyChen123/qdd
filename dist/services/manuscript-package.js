import { execFile } from 'node:child_process';
import { accessSync, constants as fsConstants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
const REQUIRED_FILES = ['main.tex', 'references.bib', 'sn-jnl.cls', 'latexmkrc', 'bst/sn-nature.bst'];
const REQUIRED_SECTIONS = ['Introduction', 'Results', 'Discussion', 'Methods'];
const PLACEHOLDER = /\b(?:TODO|TBD|citation needed)\b|待补/i;
const BIBTEX_PLACEHOLDER = /\b(?:pending|provisional|unverified|author follow-up)\b|=\s*\{\s*\}/i;
function findExecutable(name) {
    for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
        if (!directory)
            continue;
        const candidate = path.join(directory, name);
        try {
            accessSync(candidate, fsConstants.X_OK);
            return candidate;
        }
        catch {
            // Continue through PATH without repeatedly spawning probe processes.
        }
    }
    return null;
}
export function probeTexCompiler() {
    const latexmk = findExecutable('latexmk');
    const bibtex = findExecutable('bibtex');
    if (latexmk && bibtex)
        return { kind: 'latexmk', command: latexmk };
    const tectonic = findExecutable('tectonic');
    if (tectonic)
        return { kind: 'tectonic', command: tectonic };
    const pdflatex = findExecutable('pdflatex');
    if (pdflatex && bibtex)
        return { kind: 'pdflatex', command: pdflatex, bibtexCommand: bibtex };
    return null;
}
function requireMatch(value, pattern, description) {
    if (!pattern.test(value))
        throw new Error(`Manuscript validation failed: ${description}.`);
}
function parseKeys(tex) {
    return [...tex.matchAll(/\\cite(?:[A-Za-z*]*)?(?:\[[^\]]*\]){0,2}\{([^}]+)\}/g)]
        .flatMap((match) => match[1].split(',').map((key) => key.trim()).filter(Boolean));
}
function parseBibtexKeys(bibtex) {
    const keys = [...bibtex.matchAll(/^\s*@\w+\s*\{\s*([^,\s]+)\s*,/gmi)].map((match) => match[1]);
    if (keys.length === 0)
        throw new Error('Manuscript validation failed: references.bib has no BibTeX entries.');
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
    if (duplicates.length > 0)
        throw new Error(`Manuscript validation failed: duplicate BibTeX keys: ${[...new Set(duplicates)].join(', ')}.`);
    return keys;
}
function parseEnvironments(tex, environment) {
    return [...tex.matchAll(new RegExp(`\\\\begin\\{${environment}\\}`, 'g'))].map((match) => match[0]);
}
function validateBalancedEnvironments(tex) {
    const stack = [];
    for (const match of tex.matchAll(/\\(begin|end)\{([A-Za-z*]+)\}/g)) {
        const kind = match[1];
        const environment = match[2];
        if (kind === 'begin')
            stack.push(environment);
        else if (stack.pop() !== environment)
            throw new Error(`Manuscript validation failed: unbalanced ${environment} environment.`);
    }
    if (stack.length > 0)
        throw new Error(`Manuscript validation failed: unclosed ${stack.at(-1)} environment.`);
}
async function compilePdf(packageDir, compiler) {
    const common = { cwd: packageDir, timeout: 120_000, maxBuffer: 10 * 1024 * 1024 };
    try {
        if (compiler.kind === 'latexmk') {
            await execFileAsync(compiler.command, ['-pdf', '-interaction=nonstopmode', '-halt-on-error', '-jobname=paper', 'main.tex'], common);
        }
        else if (compiler.kind === 'tectonic') {
            await execFileAsync(compiler.command, ['--only-cached', '--keep-logs', '--outdir', '.', 'main.tex'], common);
            await fs.rename(path.join(packageDir, 'main.pdf'), path.join(packageDir, 'paper.pdf'));
        }
        else {
            const latexArgs = ['-interaction=nonstopmode', '-halt-on-error', '-jobname=paper', 'main.tex'];
            await execFileAsync(compiler.command, latexArgs, common);
            await execFileAsync(compiler.bibtexCommand, ['paper'], common);
            await execFileAsync(compiler.command, latexArgs, common);
            await execFileAsync(compiler.command, latexArgs, common);
        }
    }
    catch (error) {
        const detail = error;
        throw new Error(`TeX compiler '${compiler.command}' failed: ${detail.stderr || detail.stdout || detail.message}`);
    }
    await fs.access(path.join(packageDir, 'paper.pdf'));
}
export async function validateManuscriptPackage(packagePath, texCompiler = undefined) {
    const packageDir = path.resolve(packagePath);
    for (const requiredFile of REQUIRED_FILES)
        await fs.access(path.join(packageDir, requiredFile));
    await fs.access(path.join(packageDir, 'figures'));
    const tex = await fs.readFile(path.join(packageDir, 'main.tex'), 'utf-8');
    const bibtex = await fs.readFile(path.join(packageDir, 'references.bib'), 'utf-8');
    if (PLACEHOLDER.test(tex) || PLACEHOLDER.test(bibtex))
        throw new Error('Manuscript validation failed: drafting placeholder remains.');
    if (BIBTEX_PLACEHOLDER.test(bibtex))
        throw new Error('Manuscript validation failed: references.bib contains an unresolved or incomplete entry.');
    requireMatch(tex, /\\documentclass\[pdflatex,sn-nature\]\{sn-jnl\}/, 'main.tex must use the sn-nature document class');
    requireMatch(tex, /\\title\{\s*[^}\s][\s\S]*?\}/, 'title is empty');
    const hasAbstractMacro = /\\abstract\{\s*[^}\s][\s\S]*?\}/.test(tex);
    const hasAbstractSection = /\\section\*\{Abstract\}\s*\n\s*[^\s]/.test(tex);
    if (!hasAbstractMacro && !hasAbstractSection)
        throw new Error('Manuscript validation failed: abstract is empty.');
    requireMatch(tex, /\\keywords\{\s*[^}\s][\s\S]*?\}/, 'keywords are empty');
    if (/\\(?:author|affil)\b/.test(tex))
        throw new Error('Manuscript validation failed: author or affiliation block is present.');
    validateBalancedEnvironments(tex);
    const sections = [...tex.matchAll(/\\section\{([^}]+)\}/g)].map((match) => match[1]);
    if (sections.join('\0') !== REQUIRED_SECTIONS.join('\0')) {
        throw new Error(`Manuscript validation failed: required section order is ${REQUIRED_SECTIONS.join(', ')}.`);
    }
    const abstractIndex = hasAbstractMacro ? tex.indexOf('\\abstract') : tex.indexOf('\\section*{Abstract}');
    if (abstractIndex > tex.indexOf('\\section{Introduction}')) {
        throw new Error('Manuscript validation failed: Abstract must precede Introduction.');
    }
    const bibliographyIndex = tex.indexOf('\\bibliography{references}');
    if (bibliographyIndex < 0 || bibliographyIndex < tex.indexOf('\\section{Methods}')) {
        throw new Error('Manuscript validation failed: bibliography must follow Methods.');
    }
    const firstFloatIndex = Math.min(...['\\begin{figure}', '\\begin{table}'].map((marker) => {
        const index = tex.indexOf(marker);
        return index < 0 ? Number.POSITIVE_INFINITY : index;
    }));
    if (firstFloatIndex !== Number.POSITIVE_INFINITY && firstFloatIndex < bibliographyIndex) {
        throw new Error('Manuscript validation failed: figures and tables must follow the bibliography.');
    }
    const citations = [...new Set(parseKeys(tex))].sort();
    const bibliographyEntries = parseBibtexKeys(bibtex).sort();
    const missingCitations = citations.filter((key) => !bibliographyEntries.includes(key));
    if (missingCitations.length > 0)
        throw new Error(`Manuscript validation failed: citations missing from references.bib: ${missingCitations.join(', ')}.`);
    const labels = [...tex.matchAll(/\\label\{([^}]+)\}/g)].map((match) => match[1]);
    const duplicateLabels = labels.filter((label, index) => labels.indexOf(label) !== index);
    if (duplicateLabels.length > 0)
        throw new Error(`Manuscript validation failed: duplicate labels: ${[...new Set(duplicateLabels)].join(', ')}.`);
    const references = [...tex.matchAll(/\\(?:ref|autoref)\{([^}]+)\}/g)].map((match) => match[1]);
    const missingReferences = references.filter((reference) => !labels.includes(reference));
    if (missingReferences.length > 0)
        throw new Error(`Manuscript validation failed: broken cross-references: ${[...new Set(missingReferences)].join(', ')}.`);
    const graphics = [...tex.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g)].map((match) => match[1]);
    for (const graphic of graphics) {
        if (!graphic.startsWith('figures/'))
            throw new Error(`Manuscript validation failed: figure asset must be under figures/: ${graphic}.`);
        await fs.access(path.join(packageDir, graphic));
    }
    const compiler = texCompiler === undefined ? probeTexCompiler() : texCompiler;
    if (compiler)
        await compilePdf(packageDir, compiler);
    const report = {
        schema_version: 1,
        package_dir: packageDir,
        citations,
        bibliography_entries: bibliographyEntries,
        labels: [...new Set(labels)].sort(),
        references: [...new Set(references)].sort(),
        figures: parseEnvironments(tex, 'figure'),
        tables: parseEnvironments(tex, 'table'),
        checks: {
            required_files: 'passed', tex_structure: 'passed', placeholders: 'passed', sections: 'passed',
            bibliography_order: 'passed', citations: 'passed', cross_references: 'passed', assets: 'passed',
        },
        tex_compiler: compiler?.command ?? null,
        pdf_status: compiler ? 'compiled' : 'unavailable',
        pdf_path: compiler ? path.join(packageDir, 'paper.pdf') : null,
    };
    await fs.writeFile(path.join(packageDir, 'manuscript-validation.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
    return report;
}
export function natureTemplateRoot() {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'runtime', 'manuscript-templates', 'nature');
}
//# sourceMappingURL=manuscript-package.js.map