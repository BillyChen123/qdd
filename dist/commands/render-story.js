import path from 'node:path';
import { renderAcceptedStory } from '../services/story-tex.js';
export async function renderStoryCommand(storyPath, options = {}) {
    const projectRoot = process.cwd();
    const report = await renderAcceptedStory({
        storyPath,
        projectRoot,
        outputDir: options.output,
        bibliographyPath: options.bibliography,
        gate2Accepted: options.gate2Accepted === true,
    });
    if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }
    console.log(`TeX package: ${path.resolve(projectRoot, report.output_dir)}`);
    console.log(`Mechanical checks: passed`);
    console.log(`Story coverage: ${report.coverage.rendered_blocks}/${report.coverage.story_blocks}`);
    console.log(`PDF status: ${report.pdf_status}`);
    if (report.pdf_path)
        console.log(`PDF: ${path.resolve(projectRoot, report.pdf_path)}`);
}
//# sourceMappingURL=render-story.js.map