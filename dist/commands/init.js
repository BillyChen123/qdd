import path from 'node:path';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from '../runtime/constants.js';
import { createDefaultArtifactIndex, createDefaultEvolutionTrail, createDefaultInstructionsMarkdown, createDefaultLayerPolicy, createDefaultResourcesMarkdown, createDefaultResearchContract, } from '../runtime/defaults.js';
import { installBootstrap, resolveBootstrapToolsForInit } from '../runtime/bootstrap.js';
import { refreshSkillsCatalog } from '../runtime/local-skills.js';
import { writeYamlFile } from '../runtime/store.js';
export async function initCommand(targetPath = '.', options = {}) {
    const projectRoot = path.resolve(targetPath);
    await FileSystemUtils.createDirectory(projectRoot);
    const contractPath = path.join(projectRoot, PATHS.contract);
    const evolutionPath = path.join(projectRoot, PATHS.evolution);
    const artifactIndexPath = path.join(projectRoot, PATHS.artifactIndex);
    const instructionsPath = path.join(projectRoot, PATHS.instructions);
    const resourcesPath = path.join(projectRoot, PATHS.contextResources);
    const layerPolicyPath = path.join(projectRoot, PATHS.layerPolicy);
    // Bootstrap only the minimum durable state needed for later CLI reads.
    // Study/task records are created by later workflow commands, not at init time.
    if (!(await FileSystemUtils.fileExists(contractPath))) {
        await writeYamlFile(projectRoot, PATHS.contract, createDefaultResearchContract());
    }
    if (!(await FileSystemUtils.fileExists(evolutionPath))) {
        await writeYamlFile(projectRoot, PATHS.evolution, createDefaultEvolutionTrail());
    }
    if (!(await FileSystemUtils.fileExists(artifactIndexPath))) {
        await writeYamlFile(projectRoot, PATHS.artifactIndex, createDefaultArtifactIndex());
    }
    if (options.refreshBootstrap || !(await FileSystemUtils.fileExists(instructionsPath))) {
        await FileSystemUtils.writeFile(instructionsPath, createDefaultInstructionsMarkdown());
    }
    if (!(await FileSystemUtils.fileExists(resourcesPath))) {
        await FileSystemUtils.writeFile(resourcesPath, createDefaultResourcesMarkdown());
    }
    if (!(await FileSystemUtils.fileExists(layerPolicyPath))) {
        await writeYamlFile(projectRoot, PATHS.layerPolicy, createDefaultLayerPolicy());
    }
    await Promise.all([
        FileSystemUtils.createDirectory(path.join(projectRoot, PATHS.contextDir)),
        FileSystemUtils.createDirectory(path.join(projectRoot, PATHS.studiesDir)),
        FileSystemUtils.createDirectory(path.join(projectRoot, PATHS.artifactDataDir)),
        FileSystemUtils.createDirectory(path.join(projectRoot, PATHS.artifactCodeDir)),
        FileSystemUtils.createDirectory(path.join(projectRoot, PATHS.artifactFiguresDir)),
        FileSystemUtils.createDirectory(path.join(projectRoot, PATHS.artifactReportsDir)),
        FileSystemUtils.createDirectory(path.join(projectRoot, PATHS.qddDir)),
    ]);
    const bootstrapTools = await resolveBootstrapToolsForInit(projectRoot, options.tools);
    await installBootstrap(projectRoot, {
        tools: bootstrapTools,
        refresh: options.refreshBootstrap ?? false,
        domainSkillsSourceDir: options.domainSkillsSourceDir,
    });
    await refreshSkillsCatalog(projectRoot);
}
//# sourceMappingURL=init.js.map