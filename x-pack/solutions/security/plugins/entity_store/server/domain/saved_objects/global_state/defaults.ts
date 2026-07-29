/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { LogExtractionConfigShape } from './constants';

type DefaultsVersion = keyof typeof GLOBAL_LOG_EXTRACTION_DEFAULTS;

const LOG_EXTRACTION_DEFAULTS_VERSION: DefaultsVersion = 2;

const DEFAULTS_V1 = {
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
} as const satisfies LogExtractionConfigShape & { defaultsVersion: 1 };

const DEFAULTS_V2 = {
  ...DEFAULTS_V1,
  maxLogsPerPage: 100_000,
  frequency: '10m',
  defaultsVersion: 2,
} as const satisfies LogExtractionConfigShape & { defaultsVersion: 2 };

export const GLOBAL_LOG_EXTRACTION_DEFAULTS = {
  1: DEFAULTS_V1,
  2: DEFAULTS_V2,
} as const satisfies Record<number, LogExtractionConfigShape>;

export const LATEST_LOG_EXTRACTION_DEFAULTS =
  GLOBAL_LOG_EXTRACTION_DEFAULTS[LOG_EXTRACTION_DEFAULTS_VERSION];

export const isLogExtractionConfigVersion = (value: number): value is DefaultsVersion =>
  typeof value === 'number' && value in GLOBAL_LOG_EXTRACTION_DEFAULTS;

export const getConfigDefaults = (version: DefaultsVersion): LogExtractionConfigShape =>
  GLOBAL_LOG_EXTRACTION_DEFAULTS[version];

export const getConfigOverrides = (
  config: Partial<LogExtractionConfigShape>,
  configDefaults: LogExtractionConfigShape
): Partial<LogExtractionConfigShape> =>
  Object.keys(configDefaults).reduce((acc, key) => {
    const configValue = config[key as keyof typeof config];
    const configDefaultValue = configDefaults[key as keyof typeof configDefaults];
    if (configValue !== undefined && configValue !== configDefaultValue) {
      acc[key as keyof typeof acc] = configValue as never;
    }
    return acc;
  }, {} as Partial<LogExtractionConfigShape>);
