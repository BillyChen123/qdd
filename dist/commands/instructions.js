import { buildInstructions } from '../services/instructions.js';
import { requireQddProjectRoot, resolveProjectRoot } from '../runtime/paths.js';
export async function instructionsCommand(id, options = {}) {
    if (!id) {
        throw new Error('Missing required argument <id>.');
    }
    const projectRoot = resolveProjectRoot();
    await requireQddProjectRoot(projectRoot);
    const instructions = await buildInstructions(projectRoot, id, {
        command: options.command,
    });
    if (options.json) {
        console.log(JSON.stringify(instructions, null, 2));
        return;
    }
    console.log(`Command: ${instructions.command ?? 'none'}`);
    console.log(`Target: ${instructions.target.kind} ${instructions.target.id}`);
    console.log(`Role: ${instructions.role}`);
    console.log('Read:');
    for (const file of instructions.read)
        console.log(`  - ${file}`);
    console.log('Write:');
    for (const file of instructions.write)
        console.log(`  - ${file}`);
}
//# sourceMappingURL=instructions.js.map