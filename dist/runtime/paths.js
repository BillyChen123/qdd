import path from 'node:path';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
export function resolveProjectRoot(startPath = process.cwd()) {
    return path.resolve(startPath);
}
export async function isQddProjectRoot(projectRoot) {
    const hasContract = await FileSystemUtils.fileExists(path.join(projectRoot, PATHS.contract));
    const hasQddDir = await FileSystemUtils.directoryExists(path.join(projectRoot, PATHS.qddDir));
    return hasContract && hasQddDir;
}
export async function requireQddProjectRoot(projectRoot) {
    if (!(await isQddProjectRoot(projectRoot))) {
        throw new Error(`No QDD project found at ${projectRoot}. Run 'qdd init' first.`);
    }
}
//# sourceMappingURL=paths.js.map