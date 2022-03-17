<<<<<<< HEAD
<<<<<<< HEAD
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { SavedObjectsType } from '../../../../../src/core/server';
import {
  type CspRuleTemplateSchema,
  cspRuleTemplateSavedObjectType,
} from '../../common/schemas/csp_rule_template';

const ruleTemplateAssetSavedObjectMappings: SavedObjectsType<CspRuleTemplateSchema>['mappings'] = {
  dynamic: false,
  properties: {
    name: {
      type: 'text', // search
      fields: {
        // TODO: how is fields mapping shared with UI ?
        raw: {
          type: 'keyword', // sort
        },
      },
    },
    description: {
      type: 'text',
    },
  },
};

export const cspRuleTemplateAssetType: SavedObjectsType<CspRuleTemplateSchema> = {
  name: cspRuleTemplateSavedObjectType,
  hidden: false,
  management: {
    importableAndExportable: true,
    visibleInManagement: false,
  },
  namespaceType: 'agnostic',
  mappings: ruleTemplateAssetSavedObjectMappings,
};
||||||| parent of 03324579a89 (fix paths post main merge)
=======
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { SavedObjectsType } from '../../../../../../src/core/server';
import {
  type CspRuleTemplateSchema,
  cspRuleTemplateSavedObjectType,
} from '../../../common/schemas/csp_rule_template';

const ruleTemplateAssetSavedObjectMappings: SavedObjectsType<CspRuleTemplateSchema>['mappings'] = {
  dynamic: false,
  properties: {
    name: {
      type: 'text', // search
      fields: {
        // TODO: how is fields mapping shared with UI ?
        raw: {
          type: 'keyword', // sort
        },
      },
    },
    description: {
      type: 'text',
    },
  },
};

export const cspRuleTemplateAssetType: SavedObjectsType<CspRuleTemplateSchema> = {
  name: cspRuleTemplateSavedObjectType,
  hidden: false,
  management: {
    importableAndExportable: true,
    visibleInManagement: false,
  },
  namespaceType: 'agnostic',
  mappings: ruleTemplateAssetSavedObjectMappings,
};
>>>>>>> 03324579a89 (fix paths post main merge)
||||||| parent of e7da7d89366 (update template path)
=======
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { SavedObjectsType } from '../../../../../src/core/server';
import {
  type CloudSecurityPostureRuleTemplateSchema,
  cloudSecurityPostureRuleTemplateSavedObjectType,
} from '../../common/schemas/csp_rule_template';

const ruleTemplateAssetSavedObjectMappings: SavedObjectsType<CloudSecurityPostureRuleTemplateSchema>['mappings'] =
  {
    dynamic: false,
    properties: {},
  };

export const cspRuleTemplateAssetType: SavedObjectsType<CloudSecurityPostureRuleTemplateSchema> = {
  name: cloudSecurityPostureRuleTemplateSavedObjectType,
  hidden: false,
  management: {
    importableAndExportable: true,
    visibleInManagement: false,
  },
  namespaceType: 'agnostic',
  mappings: ruleTemplateAssetSavedObjectMappings,
};
>>>>>>> e7da7d89366 (update template path)
