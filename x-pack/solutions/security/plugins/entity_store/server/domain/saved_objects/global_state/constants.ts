/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';

export const DEFAULT_HISTORY_SNAPSHOT_FREQUENCY = '24h';

export const isLogExtractionConfigVersion = (
  value: number
): value is keyof typeof GLOBAL_DEFAULTS => typeof value === 'number' && value in GLOBAL_DEFAULTS;

const LOG_EXTRACTION_DEFAULTS_VERSION: keyof typeof GLOBAL_DEFAULTS = 2;
const GLOBAL_DEFAULTS_V1 = {
  additionalIndexPatterns: [],
  excludedIndexPatterns: [],
  fieldHistoryLength: 10,
  lookbackPeriod: '3h',
  delay: '1m',
  docsLimit: 10_000,
  maxLogsPerPage: 50_000,
  timeout: '59s',
  frequency: '1m',
  maxTimeWindowSize: '15m',
  maxLogsPerWindow: 100_000,
  maxLogsPerWindowCapBehavior: 'drop',
  defaultsVersion: 1,
} as const satisfies LogExtractionConfigShape;

export const GLOBAL_DEFAULTS = {
  1: GLOBAL_DEFAULTS_V1,
  2: {
    ...GLOBAL_DEFAULTS_V1,
    maxLogsPerPage: 100_000,
    frequency: '10m',
    defaultsVersion: 2,
  },
} as const satisfies Record<number, LogExtractionConfigShape>;

export const LATEST_DEFAULTS = GLOBAL_DEFAULTS[LOG_EXTRACTION_DEFAULTS_VERSION];

const DurationSchema = z.string().regex(/[smdh]$/);
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
  defaultsVersion: z.number().int(),
});

const base = LogExtractionConfigFields.shape;

export type LogExtractionConfigShape = z.infer<typeof LogExtractionConfigFields>;
export type LogExtractionConfig = z.infer<typeof LogExtractionConfig>;
export const LogExtractionConfig = z.object({
  additionalIndexPatterns: base.additionalIndexPatterns.default(
    LATEST_DEFAULTS.additionalIndexPatterns
  ),
  excludedIndexPatterns: base.excludedIndexPatterns.default(LATEST_DEFAULTS.excludedIndexPatterns),
  fieldHistoryLength: base.fieldHistoryLength.default(LATEST_DEFAULTS.fieldHistoryLength),
  lookbackPeriod: base.lookbackPeriod.default(LATEST_DEFAULTS.lookbackPeriod),
  delay: base.delay.default(LATEST_DEFAULTS.delay),
  docsLimit: base.docsLimit.default(LATEST_DEFAULTS.docsLimit),
  maxLogsPerPage: base.maxLogsPerPage.default(LATEST_DEFAULTS.maxLogsPerPage),
  timeout: base.timeout.default(LATEST_DEFAULTS.timeout),
  frequency: base.frequency.default(LATEST_DEFAULTS.frequency),
  maxTimeWindowSize: base.maxTimeWindowSize.default(LATEST_DEFAULTS.maxTimeWindowSize),
  maxLogsPerWindow: base.maxLogsPerWindow.default(LATEST_DEFAULTS.maxLogsPerWindow),
  maxLogsPerWindowCapBehavior: base.maxLogsPerWindowCapBehavior.default(
    LATEST_DEFAULTS.maxLogsPerWindowCapBehavior
  ),
  defaultsVersion: base.defaultsVersion.default(LATEST_DEFAULTS.defaultsVersion),
});

export type HistorySnapshotStatus = z.infer<typeof HistorySnapshotStatus>;
export const HistorySnapshotStatus = z.enum(['started', 'stopped']);

export type HistorySnapshotState = z.infer<typeof HistorySnapshotState>;
export const HistorySnapshotState = z.object({
  status: HistorySnapshotStatus.default('started'),
  frequency: z
    .string()
    .regex(/[smdh]$/)
    .default(DEFAULT_HISTORY_SNAPSHOT_FREQUENCY),
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
  logsExtraction: LogExtractionConfig,
});
