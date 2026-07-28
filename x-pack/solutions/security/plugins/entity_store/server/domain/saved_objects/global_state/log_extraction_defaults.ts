/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger } from '@kbn/core/server';
import {
  GLOBAL_LOG_EXTRACTION_DEFAULTS,
  LogExtractionConfig,
  isLogExtractionConfigVersion,
} from './constants';

/**
 * Resolves a log-extraction config against versioned defaults:
 * strip values equal to the config's own `defaultsVersion` pin, omit the pin,
 * then let Zod fill LATEST (including `defaultsVersion`).
 * Unknown / missing pins keep all other provided fields (Zod fills only gaps).
 */
export class LogExtractionDefaults {
  constructor(private readonly logger: Logger) {}

  resolve(config: Partial<LogExtractionConfig> = {}): LogExtractionConfig {
    const { defaultsVersion: _, ...overrides } = this.getOverrides(config);
    return LogExtractionConfig.parse(overrides);
  }

  private getOverrides(config: Partial<LogExtractionConfig>): Partial<LogExtractionConfig> {
    const { defaultsVersion } = config;

    // Sparse patches (no pin) keep all provided fields as-is.
    if (defaultsVersion === undefined) {
      return config;
    }

    if (!isLogExtractionConfigVersion(defaultsVersion)) {
      this.logger.warn(
        `Unknown log extraction config defaults version ${defaultsVersion}. Preserving persisted values.`
      );
      return config;
    }

    const configDefaults = GLOBAL_LOG_EXTRACTION_DEFAULTS[defaultsVersion];
    return Object.keys(configDefaults).reduce((acc, key) => {
      const configValue = config[key as keyof typeof config];
      const configDefaultValue = configDefaults[key as keyof typeof configDefaults];
      if (configValue !== undefined && configValue !== configDefaultValue) {
        acc[key as keyof typeof acc] = configValue as never;
      }
      return acc;
    }, {} as Partial<LogExtractionConfig>);
  }
}
