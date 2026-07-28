/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';
import { isEqual } from 'lodash';
import type { EntityType } from '../../../../common';

export const DEFAULT_HISTORY_SNAPSHOT_FREQUENCY = '24h';

export const LOG_EXTRACTION_DELAY_DEFAULT = '1m';
export const LOG_EXTRACTION_LOOKBACK_PERIOD_DEFAULT = '3h';
export const LOG_EXTRACTION_FREQUENCY_DEFAULT = '1m';
/** Max entities to extract in one ESQL query */
export const LOG_EXTRACTION_DOCS_LIMIT_DEFAULT = 10000;
/** Max raw log documents per page processed in a query */
export const LOG_EXTRACTION_MAX_LOGS_PER_PAGE_DEFAULT = 50_000;
export const LOG_EXTRACTION_TIMEOUT_DEFAULT = '59s';
export const LOG_EXTRACTION_MAX_TIME_WINDOW_SIZE_DEFAULT = '15m';
/** Max total raw log documents to process per task run; 0 = no cap */
export const LOG_EXTRACTION_MAX_LOGS_PER_WINDOW_DEFAULT = 100_000;
export const LOG_EXTRACTION_CAP_BEHAVIOR_DEFAULT = 'drop' as const;

const DurationSchema = z.string().regex(/[smdh]$/);

/** Full runtime config shape (no Zod field defaults — filled via resolve). */
export type LogExtractionConfig = z.infer<typeof LogExtractionConfigFields>;
export const LogExtractionConfigFields = z.object({
  additionalIndexPatterns: z.array(z.string()),
  excludedIndexPatterns: z.array(z.string()),
  fieldHistoryLength: z.number().int(),
  lookbackPeriod: DurationSchema,
  delay: DurationSchema,
  docsLimit: z.number().int().min(1),
  maxLogsPerPage: z.number().int().min(1),
  timeout: DurationSchema,
  frequency: DurationSchema,
  maxTimeWindowSize: DurationSchema,
  maxLogsPerWindow: z.number().int().min(0),
  maxLogsPerWindowCapBehavior: z.enum(['defer', 'drop']),
});

/**
 * @deprecated Use {@link LogExtractionConfigFields} — kept so existing `.pick` / `.parse` call
 * sites that expect a Zod object named `LogExtractionConfig` keep compiling during migration.
 * Prefer {@link resolveLogExtractionConfig} for full configs.
 */
export const LogExtractionConfig = LogExtractionConfigFields;

/** Persisted sparse overrides + the defaults snapshot they were last compared against. */
export type StoredLogsExtraction = z.infer<typeof StoredLogsExtraction>;
export const StoredLogsExtraction = LogExtractionConfigFields.partial().extend({
  defaultsVersion: z.number().int().min(1).default(1),
});

export type LogExtractionConfigInput = z.infer<typeof LogExtractionConfigInput>;
export const LogExtractionConfigInput = LogExtractionConfigFields.omit({ timeout: true }).partial();

const GLOBAL_DEFAULTS_V1: LogExtractionConfig = {
  additionalIndexPatterns: [],
  excludedIndexPatterns: [],
  fieldHistoryLength: 10,
  lookbackPeriod: LOG_EXTRACTION_LOOKBACK_PERIOD_DEFAULT,
  delay: LOG_EXTRACTION_DELAY_DEFAULT,
  docsLimit: LOG_EXTRACTION_DOCS_LIMIT_DEFAULT,
  maxLogsPerPage: LOG_EXTRACTION_MAX_LOGS_PER_PAGE_DEFAULT,
  timeout: LOG_EXTRACTION_TIMEOUT_DEFAULT,
  frequency: LOG_EXTRACTION_FREQUENCY_DEFAULT,
  maxTimeWindowSize: LOG_EXTRACTION_MAX_TIME_WINDOW_SIZE_DEFAULT,
  maxLogsPerWindow: LOG_EXTRACTION_MAX_LOGS_PER_WINDOW_DEFAULT,
  maxLogsPerWindowCapBehavior: LOG_EXTRACTION_CAP_BEHAVIOR_DEFAULT,
};

/**
 * Immutable global default snapshots. Append only — never edit a past entry.
 * - 1: original store-wide defaults
 * - 2: same store-wide values (per-type cadence lives in PER_TYPE_DEFAULTS v2)
 */
export const GLOBAL_DEFAULTS = {
  1: GLOBAL_DEFAULTS_V1,
  2: { ...GLOBAL_DEFAULTS_V1 },
} as const satisfies Record<number, LogExtractionConfig>;

/**
 * Immutable per-type default snapshots (sparse). Only fields that differ from global defaults.
 * - 1: no per-type overlays (everything came from global)
 * - 2: service/generic extract cadence
 */
export const PER_TYPE_DEFAULTS = {
  1: {} as Partial<Record<EntityType, Partial<LogExtractionConfig>>>,
  2: {
    service: { frequency: '10m' },
    generic: { frequency: '30m' },
  } as Partial<Record<EntityType, Partial<LogExtractionConfig>>>,
} as const;

export type LogExtractionDefaultsVersion = keyof typeof GLOBAL_DEFAULTS & number;

export const CURRENT_LOG_EXTRACTION_DEFAULTS_VERSION =
  2 as const satisfies LogExtractionDefaultsVersion;

const CONFIG_KEYS = Object.keys(LogExtractionConfigFields.shape) as Array<
  keyof LogExtractionConfig
>;

/** Drop fields still equal to `baseline`; always returns CURRENT defaultsVersion. */
export const omitDefaults = <T extends Partial<LogExtractionConfig>>(
  config: T & { defaultsVersion?: number },
  baseline: Partial<LogExtractionConfig>
): StoredLogsExtraction => {
  const overrides: Partial<LogExtractionConfig> = {};
  for (const key of CONFIG_KEYS) {
    const value = config[key];
    if (value === undefined) {
      continue;
    }
    if (!isEqual(value, baseline[key])) {
      overrides[key] = value as never;
    }
  }
  return {
    ...overrides,
    defaultsVersion: CURRENT_LOG_EXTRACTION_DEFAULTS_VERSION,
  };
};

export const omitGlobalDefaults = (
  stored: Partial<LogExtractionConfig> & { defaultsVersion?: number }
): StoredLogsExtraction => {
  const version = (stored.defaultsVersion ?? 1) as LogExtractionDefaultsVersion;
  const baseline = GLOBAL_DEFAULTS[version] ?? GLOBAL_DEFAULTS[1];
  return omitDefaults(stored, baseline);
};

export const omitLocalDefaults = (
  entityType: EntityType,
  stored: Partial<LogExtractionConfig> & { defaultsVersion?: number }
): StoredLogsExtraction => {
  const version = (stored.defaultsVersion ?? 1) as LogExtractionDefaultsVersion;
  const baseline = PER_TYPE_DEFAULTS[version]?.[entityType] ?? {};
  return omitDefaults(stored, baseline);
};

/**
 * Low → high: global defaults, per-type defaults, global overrides, local overrides.
 */
export const resolveLogExtractionConfig = (
  entityType: EntityType,
  globalStored: Partial<LogExtractionConfig> & { defaultsVersion?: number } = {},
  localStored: Partial<LogExtractionConfig> & { defaultsVersion?: number } = {}
): LogExtractionConfig => {
  const { defaultsVersion: _g, ...globalOverrides } = omitGlobalDefaults(globalStored);
  const { defaultsVersion: _l, ...localOverrides } = omitLocalDefaults(entityType, localStored);

  return {
    ...GLOBAL_DEFAULTS[CURRENT_LOG_EXTRACTION_DEFAULTS_VERSION],
    ...(PER_TYPE_DEFAULTS[CURRENT_LOG_EXTRACTION_DEFAULTS_VERSION][entityType] ?? {}),
    ...globalOverrides,
    ...localOverrides,
  };
};

/** Store-wide resolve (no per-type layer) — used when writing the global SO. */
export const resolveGlobalLogExtractionConfig = (
  globalStored: Partial<LogExtractionConfig> & { defaultsVersion?: number } = {}
): LogExtractionConfig => {
  const { defaultsVersion: _, ...globalOverrides } = omitGlobalDefaults(globalStored);
  return {
    ...GLOBAL_DEFAULTS[CURRENT_LOG_EXTRACTION_DEFAULTS_VERSION],
    ...globalOverrides,
  };
};

/** Build sparse global storage from a patch / install body. */
export const toStoredGlobalLogsExtraction = (
  patch: Partial<LogExtractionConfig> = {},
  existing: Partial<LogExtractionConfig> & { defaultsVersion?: number } = {}
): StoredLogsExtraction => {
  const resolved = {
    ...resolveGlobalLogExtractionConfig(existing),
    ...patch,
  };
  return omitDefaults(resolved, GLOBAL_DEFAULTS[CURRENT_LOG_EXTRACTION_DEFAULTS_VERSION]);
};

/** Build sparse local storage from a patch. */
export const toStoredLocalLogsExtraction = (
  entityType: EntityType,
  patch: Partial<LogExtractionConfig> = {},
  existing: Partial<LogExtractionConfig> & { defaultsVersion?: number } = {}
): StoredLogsExtraction => {
  const typeDefaults = PER_TYPE_DEFAULTS[CURRENT_LOG_EXTRACTION_DEFAULTS_VERSION][entityType] ?? {};
  const { defaultsVersion: _, ...existingOverrides } = omitLocalDefaults(entityType, existing);
  const resolved = {
    ...typeDefaults,
    ...existingOverrides,
    ...patch,
  };
  return omitDefaults(resolved, typeDefaults);
};

export type HistorySnapshotStatus = z.infer<typeof HistorySnapshotStatus>;
export const HistorySnapshotStatus = z.enum(['started', 'stopped']);

export type HistorySnapshotState = z.infer<typeof HistorySnapshotState>;
export const HistorySnapshotState = z.object({
  status: HistorySnapshotStatus.default('started'),
  frequency: DurationSchema.default(DEFAULT_HISTORY_SNAPSHOT_FREQUENCY),
  lastExecutionTimestamp: z.string().optional(),
  lastError: z
    .object({
      message: z.string(),
      timestamp: z.string().optional(),
    })
    .optional(),
});

export type EntityStoreGlobalState = z.infer<typeof EntityStoreGlobalState>;
export const EntityStoreGlobalState = z.object({
  historySnapshot: HistorySnapshotState,
  logsExtraction: StoredLogsExtraction,
});
