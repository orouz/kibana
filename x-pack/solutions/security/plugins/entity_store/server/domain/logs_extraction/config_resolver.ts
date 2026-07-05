/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { EntityType } from '../../../common';
import { LOG_EXTRACTION_FREQUENCY_DEFAULT } from '../saved_objects';
import type { LogExtractionConfig, EngineLogExtractionOverrides } from '../saved_objects';

/**
 * Per-entity-type frequency baseline. This is the *default* extraction cadence for each
 * type; it lives in code (not in a saved object) and is applied at read time. Service and
 * Generic default to a reduced cadence; Host/User keep the system default. See #269261.
 *
 * Because these defaults are per type, the store-wide global config no longer carries a
 * `frequency` default (see `LogExtractionConfig`) — otherwise a single store-wide value
 * would always win over these per-type baselines.
 */
/**
 * A fully-resolved log extraction config. Unlike the store-wide `LogExtractionConfig`
 * (where `frequency` is optional), a resolved config always has a concrete `frequency`,
 * because the per-type default supplies one for every entity type.
 */
export type ResolvedLogExtractionConfig = Omit<LogExtractionConfig, 'frequency'> & {
  frequency: string;
};

export const LOG_EXTRACTION_DEFAULTS_BY_TYPE: Record<EntityType, { frequency: string }> = {
  host: { frequency: LOG_EXTRACTION_FREQUENCY_DEFAULT },
  user: { frequency: LOG_EXTRACTION_FREQUENCY_DEFAULT },
  service: { frequency: '10m' },
  generic: { frequency: '30m' },
};

/**
 * Resolves the effective log extraction config for an entity type by layering, lowest to
 * highest precedence:
 *   per-type default  <  store-wide global config  <  this engine's override
 *
 * Only `frequency` has a per-type default, so it's the one field the base layer supplies;
 * every other field comes from the global config unless the engine overrides it. The
 * returned config always has a concrete `frequency`.
 */
export const resolveLogExtractionConfig = (
  type: EntityType,
  globalConfig: LogExtractionConfig,
  override: EngineLogExtractionOverrides | undefined
): ResolvedLogExtractionConfig => ({
  ...globalConfig,
  ...override,
  frequency:
    override?.frequency ?? globalConfig.frequency ?? LOG_EXTRACTION_DEFAULTS_BY_TYPE[type].frequency,
});
