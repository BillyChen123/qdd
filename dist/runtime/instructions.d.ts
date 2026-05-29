import type { InstructionsJson, QddCommand } from '../types.js';
export interface BuildInstructionsOptions {
    command?: QddCommand;
}
export declare function buildInstructions(projectRoot: string, id: string, options?: BuildInstructionsOptions): Promise<InstructionsJson>;
//# sourceMappingURL=instructions.d.ts.map