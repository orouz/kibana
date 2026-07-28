/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  CURRENT_LOG_EXTRACTION_DEFAULTS_VERSION,
  GLOBAL_DEFAULTS,
  omitGlobalDefaults,
  resolveLogExtractionConfig,
  toStoredGlobalLogsExtraction,
  toStoredLocalLogsExtraction,
} from './constants';

describe('log extraction defaults resolve/omit', () => {
  it('propagates per-type CURRENT defaults for existing v1 dense global SO', () => {
    const stored = {
      ...GLOBAL_DEFAULTS[1],
      defaultsVersion: 1 as const,
    };

    expect(resolveLogExtractionConfig('service', stored).frequency).toBe('10m');
    expect(resolveLogExtractionConfig('generic', stored).frequency).toBe('30m');
    expect(resolveLogExtractionConfig('host', stored).frequency).toBe('1m');
  });

  it('preserves global frequency overrides over per-type defaults', () => {
    const stored = toStoredGlobalLogsExtraction({ frequency: '5m' });
    expect(stored.frequency).toBe('5m');
    expect(stored.defaultsVersion).toBe(CURRENT_LOG_EXTRACTION_DEFAULTS_VERSION);

    expect(resolveLogExtractionConfig('service', stored).frequency).toBe('5m');
    expect(resolveLogExtractionConfig('host', stored).frequency).toBe('5m');
  });

  it('applies local overrides on top of everything', () => {
    const global = toStoredGlobalLogsExtraction({ lookbackPeriod: '6h' });
    const local = toStoredLocalLogsExtraction('service', { frequency: '15m' });

    const resolved = resolveLogExtractionConfig('service', global, local);
    expect(resolved.lookbackPeriod).toBe('6h');
    expect(resolved.frequency).toBe('15m');
  });

  it('omits fields still on the baseline defaults', () => {
    const omitted = omitGlobalDefaults({
      ...GLOBAL_DEFAULTS[1],
      frequency: '5m',
      defaultsVersion: 1,
    });
    expect(omitted.frequency).toBe('5m');
    expect(omitted.delay).toBeUndefined();
    expect(omitted.defaultsVersion).toBe(CURRENT_LOG_EXTRACTION_DEFAULTS_VERSION);
  });
});
