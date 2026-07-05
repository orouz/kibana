/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SavedObjectsFullModelVersion } from '@kbn/core-saved-objects-server';
import type { SavedObjectsType } from '@kbn/core/server';
import { schema } from '@kbn/config-schema';
import {
  LOG_EXTRACTION_MAX_TIME_WINDOW_SIZE_DEFAULT,
  LOG_EXTRACTION_MAX_LOGS_PER_WINDOW_DEFAULT,
  LOG_EXTRACTION_CAP_BEHAVIOR_DEFAULT,
  LOG_EXTRACTION_FREQUENCY_DEFAULT,
} from './constants';

export const EntityStoreGlobalStateTypeName = 'entity-store-global-state';

export const EntityStoreGlobalStateTypeMappings: SavedObjectsType['mappings'] = {
  dynamic: false,
  // we are not searching by any fields, so we can keep the mappings empty
  properties: {},
};

const historySnapshotSchema = schema.object({
  status: schema.oneOf([schema.literal('started'), schema.literal('stopped')]),
  frequency: schema.string(),
  lastExecutionTimestamp: schema.maybe(schema.string()),
  lastError: schema.maybe(
    schema.object({
      message: schema.string(),
      timestamp: schema.maybe(schema.string()),
    })
  ),
});

const logExtractionSchemaV1 = schema.object({
  filter: schema.maybe(schema.string()),
  // large max size to avoid unbounded array validation
  additionalIndexPatterns: schema.maybe(schema.arrayOf(schema.string(), { maxSize: 10000 })),
  fieldHistoryLength: schema.maybe(schema.number()),
  lookbackPeriod: schema.maybe(schema.string()),
  delay: schema.maybe(schema.string()),
  docsLimit: schema.maybe(schema.number()),
  maxLogsPerPage: schema.maybe(schema.number()),
  timeout: schema.maybe(schema.string()),
  frequency: schema.maybe(schema.string()),
});

const globalStateSchemaV1 = schema.object({
  historySnapshot: historySnapshotSchema,
  logsExtraction: logExtractionSchemaV1,
});

const version1: SavedObjectsFullModelVersion = {
  changes: [],
  schemas: {
    create: globalStateSchemaV1,
    forwardCompatibility: globalStateSchemaV1.extends({}, { unknowns: 'ignore' }),
  },
};

const logExtractionSchemaV2 = logExtractionSchemaV1.extends({
  excludedIndexPatterns: schema.maybe(schema.arrayOf(schema.string(), { maxSize: 10000 })),
  maxTimeWindowSize: schema.maybe(schema.string()),
});

const globalStateSchemaV2 = globalStateSchemaV1.extends({
  logsExtraction: logExtractionSchemaV2,
});

const version2: SavedObjectsFullModelVersion = {
  changes: [
    {
      type: 'data_backfill',
      backfillFn: () => ({
        attributes: {
          logsExtraction: {
            excludedIndexPatterns: [],
            maxTimeWindowSize: LOG_EXTRACTION_MAX_TIME_WINDOW_SIZE_DEFAULT,
          },
        },
      }),
    },
  ],
  schemas: {
    create: globalStateSchemaV2,
    forwardCompatibility: globalStateSchemaV2.extends({}, { unknowns: 'ignore' }),
  },
};

const logExtractionSchemaV3 = logExtractionSchemaV2.extends({
  maxLogsPerWindow: schema.maybe(schema.number()),
  maxLogsPerWindowCapBehavior: schema.maybe(
    schema.oneOf([schema.literal('defer'), schema.literal('drop')] as const)
  ),
});

const globalStateSchemaV3 = globalStateSchemaV2.extends({
  logsExtraction: logExtractionSchemaV3,
});

const version3: SavedObjectsFullModelVersion = {
  changes: [
    {
      type: 'data_backfill',
      backfillFn: () => ({
        attributes: {
          logsExtraction: {
            maxLogsPerWindow: LOG_EXTRACTION_MAX_LOGS_PER_WINDOW_DEFAULT,
            maxLogsPerWindowCapBehavior: LOG_EXTRACTION_CAP_BEHAVIOR_DEFAULT,
          },
        },
      }),
    },
  ],
  schemas: {
    create: globalStateSchemaV3,
    forwardCompatibility: globalStateSchemaV3.extends({}, { unknowns: 'ignore' }),
  },
};

// v4 does not change the stored shape (`frequency` was already optional at the SO layer),
// so the schema is unchanged from v3.
const globalStateSchemaV4 = globalStateSchemaV3;

const version4: SavedObjectsFullModelVersion = {
  changes: [
    {
      // Frequency defaults are now per entity type and resolved in code
      // (`LOG_EXTRACTION_DEFAULTS_BY_TYPE`), so the store-wide config no longer carries a
      // frequency default. Existing stores persisted the legacy default (`1m`) densely;
      // strip it here so the per-type defaults (e.g. Service 10m, Generic 30m) take effect
      // on upgrade. A frequency an admin set to a non-default value is preserved. The
      // running extract tasks pick up the new cadence on their next (re)schedule. See
      // #269261.
      // `unsafe_transform` is required because this removes an attribute field, which
      // `data_backfill` (merge-only) cannot express.
      type: 'unsafe_transform',
      transformFn: (typeSafeGuard) =>
        typeSafeGuard<
          { logsExtraction?: Record<string, unknown> },
          { logsExtraction?: Record<string, unknown> }
        >((document) => {
          const logsExtraction = document.attributes.logsExtraction;
          if (logsExtraction?.frequency === LOG_EXTRACTION_FREQUENCY_DEFAULT) {
            const { frequency, ...rest } = logsExtraction;
            document.attributes.logsExtraction = rest;
          }
          return { document };
        }),
    },
  ],
  schemas: {
    create: globalStateSchemaV4,
    forwardCompatibility: globalStateSchemaV4.extends({}, { unknowns: 'ignore' }),
  },
};

export const EntityStoreGlobalStateType: SavedObjectsType = {
  name: EntityStoreGlobalStateTypeName,
  hidden: false,
  namespaceType: 'multiple-isolated',
  mappings: EntityStoreGlobalStateTypeMappings,
  modelVersions: { 1: version1, 2: version2, 3: version3, 4: version4 },
  hiddenFromHttpApis: true,
};
