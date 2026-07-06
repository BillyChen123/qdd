import { Command } from 'commander';
import { createRequire } from 'node:module';
import { initCommand } from '../commands/init.js';
import { statusCommand } from '../commands/status.js';
import { instructionsCommand } from '../commands/instructions.js';
import { addStudyCommand } from '../commands/add-study.js';
import { addTaskCommand } from '../commands/add-task.js';
import { registerArtifactCommand } from '../commands/register-artifact.js';
import { closeStudyCommand } from '../commands/close-study.js';
import { validateCommand } from '../commands/validate.js';
import { artifactsListCommand } from '../commands/artifacts-list.js';
import { contextCommand } from '../commands/context.js';
import { boundariesApplyCommand, boundariesCommand, boundariesRenderCommand, boundariesScoreCommand } from '../commands/boundaries.js';
import { skillsSuggestCommand } from '../commands/skills-suggest.js';
import { autoCommand } from '../commands/auto.js';
import { concludeCommand } from '../commands/conclude.js';
const require = createRequire(import.meta.url);
const { version } = require('../../package.json');
const program = new Command();
program
    .name('qdd')
    .description('Question-Driven Discovery CLI')
    .version(version);
program
    .command('init [path]')
    .description('Initialize a Question-Driven Discovery project')
    .option('--tool <tools...>', 'Install bootstrap assets for tools: claude|codex')
    .option('--refresh-bootstrap', 'Refresh installed bootstrap assets and .qdd/instructions.md')
    .action(async (targetPath = '.', options) => {
    try {
        await initCommand(targetPath, {
            tools: options?.tool,
            refreshBootstrap: options?.refreshBootstrap,
        });
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
program
    .command('status')
    .description('Read current project state')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
    try {
        await statusCommand(options);
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
program
    .command('validate')
    .description('Validate QDD control files and record state')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
    try {
        await validateCommand(options);
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
program
    .command('artifacts:list')
    .description('List registered artifacts')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
    try {
        await artifactsListCommand(options);
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
program
    .command('context')
    .description('Inspect project context files')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
    try {
        await contextCommand(options);
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
program
    .command('conclude')
    .description('Harvest auditable QDD evidence into conclusions/<run-id>/evidence_audit.md')
    .option('--output-dir <path>', 'Project-local output directory; defaults to conclusions/<run-id>')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
    try {
        await concludeCommand(options);
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
const boundaries = program
    .command('boundaries')
    .description('Inspect, update, or render the compatibility boundary view derived from evolution.yaml');
boundaries
    .option('--json', 'Output as JSON')
    .action(async (options) => {
    try {
        await boundariesCommand(options);
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
boundaries
    .command('apply')
    .description('Apply controlled boundary updates from a YAML manifest')
    .requiredOption('--file <path>', 'Project-local boundary update file')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
    try {
        await boundariesApplyCommand(options?.file, options);
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
boundaries
    .command('render')
    .description('Render a project-local HTML research map from evolution.yaml')
    .option('--output <path>', 'Output path within the current project', 'research-map.html')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
    try {
        await boundariesRenderCommand(options);
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
boundaries
    .command('score')
    .description('Score a target boundary set or one study against current boundary state')
    .option('--targets <ids>', 'Comma-separated target boundary IDs such as B001,B002')
    .option('--study <id>', 'Study ID whose target_boundaries should be scored')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
    try {
        await boundariesScoreCommand(options);
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
program
    .command('skills')
    .description('Inspect or resolve local executor skills')
    .command('suggest')
    .description('Suggest problem-level skills from controlled domain/stage/tag filters')
    .requiredOption('--domain <domain>', 'Controlled skill domain')
    .requiredOption('--stage <stage>', 'Controlled skill stage')
    .option('--tag <tag...>', 'Controlled tag filters')
    .option('--refresh', 'Refresh .qdd/skills-catalog.json before suggesting')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
    try {
        await skillsSuggestCommand(options);
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
program
    .command('add-study')
    .description('Create a new study scaffold')
    .option('--question <text>', 'Study question')
    .option('--hypothesis <text>', 'Study hypothesis')
    .option('--blocker <text...>', 'Known blocker lines')
    .option('--expected-artifact <text...>', 'Expected artifact lines')
    .action(async (options) => {
    try {
        await addStudyCommand({
            question: options?.question,
            hypothesis: options?.hypothesis,
            blockers: options?.blocker,
            expectedArtifacts: options?.expectedArtifact,
        });
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
program
    .command('add-task <studyId>')
    .description('Create a new task scaffold inside a study')
    .option('--goal <text>', 'Task goal')
    .option('--depends-on <taskIds...>', 'Task dependencies')
    .option('--input <path...>', 'Task input hints')
    .option('--expected-output <text...>', 'Expected output lines')
    .option('--skill <name...>', 'Concrete domain skill IDs such as plot/marker-heatmap')
    .action(async (studyId, options) => {
    try {
        await addTaskCommand(studyId, {
            goal: options?.goal,
            dependsOn: options?.dependsOn,
            inputs: options?.input,
            expectedOutputs: options?.expectedOutput,
            skills: options?.skill,
        });
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
program
    .command('register-artifact <artifactPath>')
    .description('Register a reusable artifact in artifacts/index.yaml')
    .requiredOption('--type <type>', 'Artifact type: data|code|figure|table|report')
    .requiredOption('--description <text>', 'Artifact description')
    .option('--reusable', 'Mark artifact as reusable')
    .option('--study <id>', 'Study provenance')
    .option('--task <id>', 'Task provenance')
    .option('--scope <scope>', 'Artifact scope: project|study|task')
    .option('--schema <name>', 'Artifact schema label')
    .action(async (artifactPath, options) => {
    try {
        await registerArtifactCommand(artifactPath, options);
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
program
    .command('close-study <studyId>')
    .description('Close a study and append one sparse study event to evolution.yaml')
    .requiredOption('--change-type <type>', 'Study change type: refinement|confirmation|pivot|dissolution')
    .requiredOption('--summary <text>', 'Compact closure summary written into study memory')
    .option('--open-boundary <text...>', 'Remaining open boundaries')
    .option('--next-candidate <text...>', 'One to three candidate next study questions')
    .action(async (studyId, options) => {
    try {
        await closeStudyCommand(studyId, {
            changeType: options?.changeType,
            summary: options?.summary,
            openBoundaries: options?.openBoundary,
            nextCandidates: options?.nextCandidate,
        });
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
program
    .command('instructions <id>')
    .description('Read onboarding or execution instructions for PROJECT, STUDY-XXX, or TASK-XXX')
    .option('--command <name>', 'Resolve role-aware instructions for qdd-start|qdd-propose|qdd-explore|qdd-apply|qdd-close')
    .option('--json', 'Output as JSON')
    .action(async (id, options) => {
    try {
        await instructionsCommand(id, options);
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
program
    .command('auto [prompt...]')
    .description('Start autonomous QDD research loop using the Anthropic SDK to orchestrate agent sessions')
    .option('--model <model>', 'Anthropic-compatible model to use')
    .option('--max-iterations <n>', 'Maximum loop iterations; defaults to unlimited. Use a positive integer to cap, or 0/none/unlimited for no cap')
    .option('--max-turns <n>', 'Maximum turns per agent session; defaults to unlimited. Use a positive integer to cap, or 0/none/unlimited for no cap')
    .option('--prompt <text>', 'User intent to inject into qdd-start and downstream auto phases')
    .option('--prompt-file <path>', 'Read user intent from a text/markdown file')
    .option('--dry-run', 'Show what would happen without executing')
    .option('--verbose', 'Show per-turn agent progress and phase state checks')
    .option('--json', 'Output result as JSON')
    .action(async (prompt = [], options = {}) => {
    try {
        await autoCommand(process.cwd(), prompt.join(' '), options);
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
await program.parseAsync(process.argv);
//# sourceMappingURL=index.js.map