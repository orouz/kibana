/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger } from '@kbn/core/server';
import { LogExtractionConfig } from './constants';
import {
  GLOBAL_LOG_EXTRACTION_DEFAULTS,
  getConfigOverrides,
  isLogExtractionConfigVersion,
} from './defaults';

export class LogExtractionDefaults {
  constructor(private readonly logger: Logger) {}

  resolve(config: Partial<LogExtractionConfig> = {}): LogExtractionConfig {
    const { defaultsVersion: _, ...overrides } = this.getOverrides(config);
    // parse does {...newConfigDefaults, ...existingConfigOverrides}
    return LogExtractionConfig.parse(overrides);
  }

  private getOverrides(config: Partial<LogExtractionConfig>): Partial<LogExtractionConfig> {
    const { defaultsVersion } = config;

    if (defaultsVersion === undefined || !isLogExtractionConfigVersion(defaultsVersion)) {
      this.logger.warn(
        `Unknown log extraction config defaults version ${defaultsVersion}. Preserving persisted values.: ${JSON.stringify(
          config
        )}`
      );
      return config;
    }
    const defaults = GLOBAL_LOG_EXTRACTION_DEFAULTS[defaultsVersion];
    return getConfigOverrides(config, defaults);
  }
}
