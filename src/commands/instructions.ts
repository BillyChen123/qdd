import { buildInstructions } from '../runtime/instructions.js';
import { requireQddProjectRoot, resolveProjectRoot } from '../runtime/paths.js';

export async function instructionsCommand(id: string | undefined, options: { json?: boolean } = {}): Promise<void> {
  if (!id) {
    throw new Error('Missing required argument <id>.');
  }

  const projectRoot = resolveProjectRoot();
  await requireQddProjectRoot(projectRoot);

  const instructions = await buildInstructions(projectRoot, id);

  if (options.json) {
    console.log(JSON.stringify(instructions, null, 2));
    return;
  }

  console.log(`Target: ${instructions.target.kind} ${instructions.target.id}`);
  console.log('Read:');
  for (const file of instructions.read) console.log(`  - ${file}`);
  console.log('Write:');
  for (const file of instructions.write) console.log(`  - ${file}`);
}
