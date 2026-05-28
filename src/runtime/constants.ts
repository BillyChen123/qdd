// PATHS 是运行时约定的“项目文件系统协议”。
// 也就是：QDD 代码默认认为这些文件/目录应该放在什么位置。
// 后面的 status / instructions / init 等模块，都会统一从这里取路径，
// 这样改目录结构时只需要集中改一处，而不是全项目到处改字符串。
export const PATHS = {
  contract: 'contract.yaml',
  evolution: 'evolution.yaml',
  contextDir: 'context',
  contextResources: 'context/resources.md',
  dataDir: 'data',
  studiesDir: 'studies',
  artifactsDir: 'artifacts',
  artifactIndex: 'artifacts/index.yaml',
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
  workflowSkillCategory: 'qdd',
  qddDir: '.qdd',
  instructions: '.qdd/instructions.md',
  bootstrapConfig: '.qdd/bootstrap.yaml',
} as const;
