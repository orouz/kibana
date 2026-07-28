/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SavedObjectsFullModelVersion } from '@kbn/core-saved-objects-server';
import type { SavedObjectsType } from '@kbn/core/server';
import { schema } from '@kbn/config-schema';

export const EntityStoreLocalStateTypeName = 'entity-store-local-state';

export const EntityStoreLocalStateTypeMappings: SavedObjectsType['mappings'] = {
  dynamic: false,
  properties: {
    type: { type: 'keyword' },
  },
};

const storedLogsExtractionSchema = schema.object(
  {
    defaultsVersion: schema.number(),
    additionalIndexPatterns: schema.maybe(schema.arrayOf(schema.string(), { maxSize: 10000 })),
    excludedIndexPatterns: schema.maybe(schema.arrayOf(schema.string(), { maxSize: 10000 })),
    fieldHistoryLength: schema.maybe(schema.number()),
    lookbackPeriod: schema.maybe(schema.string()),
    delay: schema.maybe(schema.string()),
    docsLimit: schema.maybe(schema.number()),
    maxLogsPerPage: schema.maybe(schema.number()),
    timeout: schema.maybe(schema.string()),
    frequency: schema.maybe(schema.string()),
    maxTimeWindowSize: schema.maybe(schema.string()),
    maxLogsPerWindow: schema.maybe(schema.number()),
    maxLogsPerWindowCapBehavior: schema.maybe(
      schema.oneOf([schema.literal('defer'), schema.literal('drop')] as const)
    ),
  },
  { unknowns: 'ignore' }
);

const localStateSchemaV1 = schema.object({
  type: schema.oneOf([
    schema.literal('user'),
    schema.literal('host'),
    schema.literal('service'),
    schema.literal('generic'),
  ]),
  logsExtraction: storedLogsExtractionSchema,
});

const version1: SavedObjectsFullModelVersion = {
  changes: [],
  schemas: {
    create: localStateSchemaV1,
    forwardCompatibility: localStateSchemaV1.extends({}, { unknowns: 'ignore' }),
  },
};

export const EntityStoreLocalStateType: SavedObjectsType = {
  name: EntityStoreLocalStateTypeName,
  hidden: false,
  namespaceType: 'multiple-isolated',
  mappings: EntityStoreLocalStateTypeMappings,
  modelVersions: { 1: version1 },
  hiddenFromHttpApis: true,
};
