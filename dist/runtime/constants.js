// PATHS 是运行时约定的“项目文件系统协议”。
// 也就是：QDD 代码默认认为这些文件/目录应该放在什么位置。
// 后面的 status / instructions / init 等模块，都会统一从这里取路径，
// 这样改目录结构时只需要集中改一处，而不是全项目到处改字符串。
export const PATHS = {
    contract: 'contract.yaml',
    evolution: 'evolution.yaml',
    contextDir: 'context',
    contextResources: 'context/resources.md',
    studiesDir: 'studies',
    artifactsDir: 'artifacts',
    artifactIndex: 'artifacts/index.yaml',
    // 共享数据入口和已提升的数据 artifact 都统一放在这里。
    // 为了兼容已有代码，后面仍然通过一个“shared data dir”的概念来读写它。
    artifactDataDir: 'artifacts/data',
    artifactCodeDir: 'artifacts/code',
    artifactFiguresDir: 'artifacts/figures',
    artifactReportsDir: 'artifacts/reports',
    artifactCandidatesFileName: 'artifact-candidates.yaml',
    claudeDir: '.claude',
    claudeCommandsDir: '.claude/commands',
    claudeSkillsDir: '.claude/skills',
    codexDir: '.codex',
    codexSkillsDir: '.codex/skills',
    codexWorkflowSkillDir: '.codex/skills/qdd',
    workflowSkillCategory: 'qdd',
    qddDir: '.qdd',
    instructions: '.qdd/instructions.md',
    bootstrapConfig: '.qdd/bootstrap.yaml',
    layerPolicy: '.qdd/layer-policy.yaml',
    skillsCatalog: '.qdd/skills-catalog.json',
};
//# sourceMappingURL=constants.js.map