import * as nodeFs from 'node:fs';
import path from 'node:path';

const fs = nodeFs.promises;

export class FileSystemUtils {
  static canonicalizeExistingPath(targetPath: string): string {
    try {
      return nodeFs.realpathSync.native(targetPath);
    } catch {
      try {
        return nodeFs.realpathSync(targetPath);
      } catch {
        return path.resolve(targetPath);
      }
    }
  }

  static async createDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  static async writeFile(filePath: string, content: string): Promise<void> {
    await this.createDirectory(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf-8');
  }

  static async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }
}
