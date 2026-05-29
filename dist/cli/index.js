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
import { skillsSuggestCommand } from '../commands/skills-suggest.js';
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
    .requiredOption('--type <type>', 'Artifact type: data|code|figure|report')
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
    .description('Close a study and append a question_delta to evolution.yaml')
    .requiredOption('--question-after <text>', 'Resulting question after study execution')
    .requiredOption('--change-type <type>', 'Question delta type: refinement|confirmation|pivot|dissolution')
    .requiredOption('--change-driver <text>', 'Primary reason for the question change')
    .option('--open-boundary <text...>', 'Remaining open boundaries')
    .action(async (studyId, options) => {
    try {
        await closeStudyCommand(studyId, {
            questionAfter: options?.questionAfter,
            changeType: options?.changeType,
            changeDriver: options?.changeDriver,
            openBoundaries: options?.openBoundary,
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
await program.parseAsync(process.argv);
//# sourceMappingURL=index.js.map