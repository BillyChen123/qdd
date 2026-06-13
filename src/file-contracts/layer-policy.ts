import type { LayerPolicy } from '../types.js';
import type { ManagedFileContract } from './shared.js';
import { renderYamlDocument } from './shared.js';

export function createDefaultLayerPolicy(): LayerPolicy {
  return {
    commands: {
      'qdd-start': 'thesis-manager',
      'qdd-propose': 'study-brain',
      'qdd-explore': 'study-brain',
      'qdd-apply': 'executor',
      'qdd-close': 'thesis-manager',
    },
    roles: {
      'thesis-manager': {
        default_skills: ['thesis/frontier-planning'],
      },
      'study-brain': {
        default_skills: [
          'brain/singlecell/scrna-planning',
          'brain/singlecell/scatac-planning',
          'brain/public-data/public-data-planning',
          'brain/public-data/reference-planning',
        ],
      },
      executor: {
        default_skills: [],
      },
    },
  };
}

export function createExampleLayerPolicy(): LayerPolicy {
  return createDefaultLayerPolicy();
}

export const layerPolicyFileContract: ManagedFileContract = {
  id: 'layer-policy',
  title: '.qdd/layer-policy.yaml',
  projectPath: '.qdd/layer-policy.yaml',
  exampleFileName: 'layer-policy.example.yaml',
  format: 'yaml',
  purpose: 'Editable command-to-role and role-to-default-skills policy.',
  fields: [
    { path: 'commands.qdd-start', type: 'QddRole', required: true, description: 'Role used for qdd-start.' },
    { path: 'commands.qdd-propose', type: 'QddRole', required: true, description: 'Role used for qdd-propose.' },
    { path: 'commands.qdd-explore', type: 'QddRole', required: true, description: 'Role used for qdd-explore.' },
    { path: 'commands.qdd-apply', type: 'QddRole', required: true, description: 'Role used for qdd-apply.' },
    { path: 'commands.qdd-close', type: 'QddRole', required: true, description: 'Role used for qdd-close.' },
    { path: 'roles.<role>.default_skills', type: 'string[]', required: true, description: 'Role-level default skill bundle.' },
  ],
  notes: [
    'This is not the same as task skills.',
    'Planning-only thesis/* and brain/* skills belong here, not in task frontmatter.',
    'Use thesis/* only for thesis-manager role defaults and brain/* only for study-brain role defaults.',
  ],
  renderExample: () => renderYamlDocument(createExampleLayerPolicy()),
};
