import { PATHS } from './constants.js';
import { createDefaultLayerPolicy } from './defaults.js';
import { readYamlFile } from './store.js';
import { normalizeTaskSkillIds } from './local-skills.js';
const VALID_LAYERS = ['project', 'study', 'task'];
const VALID_ROLES = ['thesis-manager', 'study-brain', 'executor'];
const VALID_COMMANDS = ['qdd-start', 'qdd-propose', 'qdd-explore', 'qdd-apply', 'qdd-close'];
const VALID_TARGET_KINDS = ['project', 'study', 'task'];
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isLayer(value) {
    return VALID_LAYERS.includes(value);
}
function isRole(value) {
    return VALID_ROLES.includes(value);
}
function isCommand(value) {
    return VALID_COMMANDS.includes(value);
}
function isTargetKind(value) {
    return VALID_TARGET_KINDS.includes(value);
}
function normalizeLayerEntry(layerName, value, fallback) {
    if (!isRecord(value)) {
        throw new Error(`${PATHS.layerPolicy}#layers.${layerName} must be an object.`);
    }
    const role = String(value.role ?? '').trim();
    if (!isRole(role)) {
        throw new Error(`${PATHS.layerPolicy}#layers.${layerName}.role must be one of: ${VALID_ROLES.join(', ')}.`);
    }
    return {
        role,
        required_skills: normalizeTaskSkillIds(Array.isArray(value.required_skills) ? value.required_skills.map((entry) => String(entry)) : fallback.required_skills),
        optional_skills: normalizeTaskSkillIds(Array.isArray(value.optional_skills) ? value.optional_skills.map((entry) => String(entry)) : fallback.optional_skills),
    };
}
function normalizeCommandEntry(commandName, value, fallback) {
    if (!isRecord(value)) {
        throw new Error(`${PATHS.layerPolicy}#commands.${commandName} must be an object.`);
    }
    const target = String(value.target ?? '').trim();
    if (!isTargetKind(target)) {
        throw new Error(`${PATHS.layerPolicy}#commands.${commandName}.target must be one of: ${VALID_TARGET_KINDS.join(', ')}.`);
    }
    const decisionLayer = String(value.decision_layer ?? '').trim();
    if (!isLayer(decisionLayer)) {
        throw new Error(`${PATHS.layerPolicy}#commands.${commandName}.decision_layer must be one of: ${VALID_LAYERS.join(', ')}.`);
    }
    return {
        target,
        decision_layer: decisionLayer,
    };
}
// 读取并规范化 layer policy。
// 如果项目还没有显式 policy，就退回默认 scaffold，
// 这样 instructions / validate 都能围绕同一份默认协议工作。
export async function readLayerPolicy(projectRoot) {
    const fallback = createDefaultLayerPolicy();
    try {
        const loaded = await readYamlFile(projectRoot, PATHS.layerPolicy);
        if (!isRecord(loaded)) {
            throw new Error(`${PATHS.layerPolicy} must be an object.`);
        }
        const layersValue = loaded.layers;
        if (!isRecord(layersValue)) {
            throw new Error(`${PATHS.layerPolicy} must define a layers object.`);
        }
        const commandsValue = loaded.commands;
        if (!isRecord(commandsValue)) {
            throw new Error(`${PATHS.layerPolicy} must define a commands object.`);
        }
        const normalizedLayers = {
            project: normalizeLayerEntry('project', layersValue.project, fallback.layers.project),
            study: normalizeLayerEntry('study', layersValue.study, fallback.layers.study),
            task: normalizeLayerEntry('task', layersValue.task, fallback.layers.task),
        };
        const normalizedCommands = {
            'qdd-start': normalizeCommandEntry('qdd-start', commandsValue['qdd-start'], fallback.commands['qdd-start']),
            'qdd-propose': normalizeCommandEntry('qdd-propose', commandsValue['qdd-propose'], fallback.commands['qdd-propose']),
            'qdd-explore': normalizeCommandEntry('qdd-explore', commandsValue['qdd-explore'], fallback.commands['qdd-explore']),
            'qdd-apply': normalizeCommandEntry('qdd-apply', commandsValue['qdd-apply'], fallback.commands['qdd-apply']),
            'qdd-close': normalizeCommandEntry('qdd-close', commandsValue['qdd-close'], fallback.commands['qdd-close']),
        };
        return {
            layers: normalizedLayers,
            commands: normalizedCommands,
        };
    }
    catch (error) {
        const message = error.message;
        if (message.includes(PATHS.layerPolicy) || message.includes('ENOENT') || message.includes('no such file')) {
            if (message.includes('must')) {
                throw error;
            }
            return fallback;
        }
        throw error;
    }
}
export function getRoleForLayer(policy, layer) {
    return policy.layers[layer].role;
}
export function getLayerForTargetKind(kind) {
    return kind;
}
export function resolveCommandDecisionLayer(policy, command, fallbackTargetKind) {
    if (!command) {
        return getLayerForTargetKind(fallbackTargetKind);
    }
    return policy.commands[command].decision_layer;
}
export function isQddCommand(value) {
    return isCommand(value);
}
//# sourceMappingURL=layer-policy.js.map