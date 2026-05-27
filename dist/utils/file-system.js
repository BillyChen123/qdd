import * as nodeFs from 'node:fs';
import path from 'node:path';
const fs = nodeFs.promises;
export class FileSystemUtils {
    static canonicalizeExistingPath(targetPath) {
        try {
            return nodeFs.realpathSync.native(targetPath);
        }
        catch {
            try {
                return nodeFs.realpathSync(targetPath);
            }
            catch {
                return path.resolve(targetPath);
            }
        }
    }
    static async createDirectory(dirPath) {
        await fs.mkdir(dirPath, { recursive: true });
    }
    static async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    static async directoryExists(dirPath) {
        try {
            const stats = await fs.stat(dirPath);
            return stats.isDirectory();
        }
        catch {
            return false;
        }
    }
    static async writeFile(filePath, content) {
        await this.createDirectory(path.dirname(filePath));
        await fs.writeFile(filePath, content, 'utf-8');
    }
    static async readFile(filePath) {
        return await fs.readFile(filePath, 'utf-8');
    }
}
//# sourceMappingURL=file-system.js.map