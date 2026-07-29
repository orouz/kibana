/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';
import { LATEST_LOG_EXTRACTION_DEFAULTS } from './defaults';

export const DEFAULT_HISTORY_SNAPSHOT_FREQUENCY = '24h';

export const LOG_EXTRACTION_DELAY_DEFAULT = LATEST_LOG_EXTRACTION_DEFAULTS.delay;
export const LOG_EXTRACTION_LOOKBACK_PERIOD_DEFAULT = LATEST_LOG_EXTRACTION_DEFAULTS.lookbackPeriod;
export const LOG_EXTRACTION_FREQUENCY_DEFAULT = LATEST_LOG_EXTRACTION_DEFAULTS.frequency;
// Max amount of entities to extract in one ESQL query
export const LOG_EXTRACTION_DOCS_LIMIT_DEFAULT = LATEST_LOG_EXTRACTION_DEFAULTS.docsLimit;
// Max raw log documents per logs to be processed in a query (inside elastic search)
export const LOG_EXTRACTION_MAX_LOGS_PER_PAGE_DEFAULT =
  LATEST_LOG_EXTRACTION_DEFAULTS.maxLogsPerPage;
export const LOG_EXTRACTION_TIMEOUT_DEFAULT = LATEST_LOG_EXTRACTION_DEFAULTS.timeout;
export const LOG_EXTRACTION_MAX_TIME_WINDOW_SIZE_DEFAULT =
  LATEST_LOG_EXTRACTION_DEFAULTS.maxTimeWindowSize;
// Max total raw log documents to process per task run; 0 = no cap
export const LOG_EXTRACTION_MAX_LOGS_PER_WINDOW_DEFAULT =
  LATEST_LOG_EXTRACTION_DEFAULTS.maxLogsPerWindow;
export const LOG_EXTRACTION_CAP_BEHAVIOR_DEFAULT =
  LATEST_LOG_EXTRACTION_DEFAULTS.maxLogsPerWindowCapBehavior;

const DurationSchema = z.string().regex(/[smdh]$/);
export const LogExtractionConfigBase = z.object({
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

const base = LogExtractionConfigBase.shape;

export type LogExtractionConfigShape = z.infer<typeof LogExtractionConfigBase>;
export type LogExtractionConfig = z.infer<typeof LogExtractionConfig>;
export const LogExtractionConfig = z.object({
  additionalIndexPatterns: base.additionalIndexPatterns.default(
    LATEST_LOG_EXTRACTION_DEFAULTS.additionalIndexPatterns
  ),
  excludedIndexPatterns: base.excludedIndexPatterns.default(
    LATEST_LOG_EXTRACTION_DEFAULTS.excludedIndexPatterns
  ),
  fieldHistoryLength: base.fieldHistoryLength.default(
    LATEST_LOG_EXTRACTION_DEFAULTS.fieldHistoryLength
  ),
  lookbackPeriod: base.lookbackPeriod.default(LATEST_LOG_EXTRACTION_DEFAULTS.lookbackPeriod),
  delay: base.delay.default(LATEST_LOG_EXTRACTION_DEFAULTS.delay),
  docsLimit: base.docsLimit.default(LATEST_LOG_EXTRACTION_DEFAULTS.docsLimit),
  maxLogsPerPage: base.maxLogsPerPage.default(LATEST_LOG_EXTRACTION_DEFAULTS.maxLogsPerPage),
  timeout: base.timeout.default(LATEST_LOG_EXTRACTION_DEFAULTS.timeout),
  frequency: base.frequency.default(LATEST_LOG_EXTRACTION_DEFAULTS.frequency),
  maxTimeWindowSize: base.maxTimeWindowSize.default(
    LATEST_LOG_EXTRACTION_DEFAULTS.maxTimeWindowSize
  ),
  maxLogsPerWindow: base.maxLogsPerWindow.default(LATEST_LOG_EXTRACTION_DEFAULTS.maxLogsPerWindow),
  maxLogsPerWindowCapBehavior: base.maxLogsPerWindowCapBehavior.default(
    LATEST_LOG_EXTRACTION_DEFAULTS.maxLogsPerWindowCapBehavior
  ),
  defaultsVersion: base.defaultsVersion.default(LATEST_LOG_EXTRACTION_DEFAULTS.defaultsVersion),
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

export interface EntityStoreGlobalStatePatch {
  historySnapshot?: Partial<HistorySnapshotState>;
  logsExtraction?: Partial<LogExtractionConfig>;
}
