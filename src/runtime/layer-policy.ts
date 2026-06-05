import type { LayerPolicy, QddCommand, QddRole } from '../types.js';
import { PATHS } from './constants.js';
import { createDefaultLayerPolicy } from '../file-contracts/layer-policy.js';
import { readYamlFile } from './store.js';
import { normalizeTaskSkillIds } from './local-skills.js';

const VALID_ROLES: readonly QddRole[] = ['thesis-manager', 'study-brain', 'executor'];
const VALID_COMMANDS: readonly QddCommand[] = ['qdd-start', 'qdd-propose', 'qdd-explore', 'qdd-apply', 'qdd-close'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRole(value: string): value is QddRole {
  return (VALID_ROLES as readonly string[]).includes(value);
}

function isCommand(value: string): value is QddCommand {
  return (VALID_COMMANDS as readonly string[]).includes(value);
}

function normalizeRoleConfig(roleName: QddRole, value: unknown, fallbackSkillIds: string[]): { default_skills: string[] } {
  if (!isRecord(value)) {
    throw new Error(`${PATHS.layerPolicy}#roles.${roleName} must be an object.`);
  }

  return {
    default_skills: normalizeTaskSkillIds(
      Array.isArray(value.default_skills) ? value.default_skills.map((entry) => String(entry)) : fallbackSkillIds
    ),
  };
}

function normalizeCommandEntry(commandName: QddCommand, value: unknown, fallbackRole: QddRole): QddRole {
  const role = String(value ?? '').trim() || fallbackRole;
  if (!isRole(role)) {
    throw new Error(`${PATHS.layerPolicy}#commands.${commandName} must be one of: ${VALID_ROLES.join(', ')}.`);
  }

  return role;
}

export async function readLayerPolicy(projectRoot: string): Promise<LayerPolicy> {
  const fallback = createDefaultLayerPolicy();

  try {
    const loaded = await readYamlFile<unknown>(projectRoot, PATHS.layerPolicy);
    if (!isRecord(loaded)) {
      throw new Error(`${PATHS.layerPolicy} must be an object.`);
    }

    const commandsValue = loaded.commands;
    if (!isRecord(commandsValue)) {
      throw new Error(`${PATHS.layerPolicy} must define a commands object.`);
    }

    const rolesValue = loaded.roles;
    if (!isRecord(rolesValue)) {
      throw new Error(`${PATHS.layerPolicy} must define a roles object.`);
    }

    return {
      commands: {
        'qdd-start': normalizeCommandEntry('qdd-start', commandsValue['qdd-start'], fallback.commands['qdd-start']),
        'qdd-propose': normalizeCommandEntry('qdd-propose', commandsValue['qdd-propose'], fallback.commands['qdd-propose']),
        'qdd-explore': normalizeCommandEntry('qdd-explore', commandsValue['qdd-explore'], fallback.commands['qdd-explore']),
        'qdd-apply': normalizeCommandEntry('qdd-apply', commandsValue['qdd-apply'], fallback.commands['qdd-apply']),
        'qdd-close': normalizeCommandEntry('qdd-close', commandsValue['qdd-close'], fallback.commands['qdd-close']),
      },
      roles: {
        'thesis-manager': normalizeRoleConfig(
          'thesis-manager',
          rolesValue['thesis-manager'],
          fallback.roles['thesis-manager'].default_skills
        ),
        'study-brain': normalizeRoleConfig('study-brain', rolesValue['study-brain'], fallback.roles['study-brain'].default_skills),
        executor: normalizeRoleConfig('executor', rolesValue.executor, fallback.roles.executor.default_skills),
      },
    };
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes(PATHS.layerPolicy) || message.includes('ENOENT') || message.includes('no such file')) {
      if (message.includes('must')) {
        throw error;
      }

      return fallback;
    }

    throw error;
  }
}

export function resolveCommandRole(policy: LayerPolicy, command: QddCommand | null, fallbackRole: QddRole): QddRole {
  if (!command) {
    return fallbackRole;
  }

  return policy.commands[command];
}

export function getDefaultSkillsForRole(policy: LayerPolicy, role: QddRole): string[] {
  return policy.roles[role].default_skills;
}

export function isQddCommand(value: string): value is QddCommand {
  return isCommand(value);
}
