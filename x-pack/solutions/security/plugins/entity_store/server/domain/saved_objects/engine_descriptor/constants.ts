/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';
import { EntityType } from '../../../../common/domain/definitions/entity_schema';
import { LogExtractionConfig } from '../global_state/constants';

export type EngineStatus = z.infer<typeof EngineStatus>;
export const EngineStatus = z.enum(['installing', 'started', 'stopped', 'updating', 'error']);

export type EngineLogExtractionState = z.infer<typeof EngineLogExtractionState>;
export const EngineLogExtractionState = z.object({
  /** Inclusive lower bound for the next log-slice probe and the fromDateISO for entity recovery. */
  checkpointTimestamp: z.string().nullable().default(null),
  paginationId: z.string().nullable().default(null),
  lastExecutionTimestamp: z.string().nullable().default(null),
});

/**
 * The subset of `LogExtractionConfig` fields that may be overridden per entity type. This
 * is the single source of truth for "what's overridable" — the route validation schema
 * picks the same set.
 */
export const OVERRIDABLE_LOG_EXTRACTION_FIELDS = {
  frequency: true,
  delay: true,
  lookbackPeriod: true,
} as const;

/**
 * A per-entity-type override of the overridable `LogExtractionConfig` fields. Sparse: only
 * fields the admin set for this type are present; absent fields fall through to the global
 * config (and, for `frequency`, the per-type default). `.partial()` bypasses the picked
 * fields' defaults, so an unset field stays absent rather than being filled. See #269261.
 */
export type EngineLogExtractionOverrides = z.infer<typeof EngineLogExtractionOverrides>;
export const EngineLogExtractionOverrides = LogExtractionConfig.pick(
  OVERRIDABLE_LOG_EXTRACTION_FIELDS
).partial();

export type EngineError = z.infer<typeof EngineError>;
export const EngineError = z.object({
  message: z.string(),
  action: z.enum(['init', 'extractLogs']),
});

export type VersionState = z.infer<typeof VersionState>;
export const VersionState = z.object({
  version: z.union([z.literal(1), z.literal(2)]).default(2),
  state: z.enum(['running', 'migrating']).default('running'),
  isMigratedFromV1: z.boolean().default(false),
});

export type EngineDescriptor = z.infer<typeof EngineDescriptor>;
export const EngineDescriptor = z.object({
  type: EntityType,
  status: EngineStatus,
  logExtractionState: EngineLogExtractionState,
  logExtractionOverrides: EngineLogExtractionOverrides.default({}),
  error: EngineError.nullable().default(null),
  versionState: VersionState,
});
