export declare class FileSystemUtils {
    static canonicalizeExistingPath(targetPath: string): string;
    static createDirectory(dirPath: string): Promise<void>;
    static fileExists(filePath: string): Promise<boolean>;
    static directoryExists(dirPath: string): Promise<boolean>;
    static writeFile(filePath: string, content: string): Promise<void>;
    static readFile(filePath: string): Promise<string>;
}
//# sourceMappingURL=file-system.d.ts.map