/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { loggerMock } from '@kbn/logging-mocks';
import { GLOBAL_LOG_EXTRACTION_DEFAULTS, LATEST_LOG_EXTRACTION_DEFAULTS } from './constants';
import { LogExtractionDefaults } from './log_extraction_defaults';

describe('LogExtractionDefaults', () => {
  let logger: ReturnType<typeof loggerMock.create>;
  let defaults: LogExtractionDefaults;

  beforeEach(() => {
    logger = loggerMock.create();
    defaults = new LogExtractionDefaults(logger);
  });

  describe('resolve', () => {
    it('strips values equal to the stored defaults pin and fills latest defaults', () => {
      const result = defaults.resolve({
        ...GLOBAL_LOG_EXTRACTION_DEFAULTS[1],
        delay: '5m',
      });

      expect(result.delay).toBe('5m');
      expect(result.frequency).toBe(LATEST_LOG_EXTRACTION_DEFAULTS.frequency);
      expect(result.maxLogsPerPage).toBe(LATEST_LOG_EXTRACTION_DEFAULTS.maxLogsPerPage);
      expect(result.defaultsVersion).toBe(LATEST_LOG_EXTRACTION_DEFAULTS.defaultsVersion);
    });

    it('fills latest defaults for a sparse patch with no pin', () => {
      const result = defaults.resolve({ delay: '2m' });

      expect(result.delay).toBe('2m');
      expect(result.frequency).toBe(LATEST_LOG_EXTRACTION_DEFAULTS.frequency);
      expect(result.maxLogsPerPage).toBe(LATEST_LOG_EXTRACTION_DEFAULTS.maxLogsPerPage);
      expect(result.defaultsVersion).toBe(LATEST_LOG_EXTRACTION_DEFAULTS.defaultsVersion);
    });

    it('preserves field values when defaultsVersion is unknown, but pins to latest', () => {
      const result = defaults.resolve({
        ...GLOBAL_LOG_EXTRACTION_DEFAULTS[1],
        defaultsVersion: 99,
        delay: '5m',
        frequency: '1m',
        maxLogsPerPage: 50_000,
      });

      expect(logger.warn).toHaveBeenCalled();
      expect(result.delay).toBe('5m');
      expect(result.frequency).toBe('1m');
      expect(result.maxLogsPerPage).toBe(50_000);
      expect(result.defaultsVersion).toBe(LATEST_LOG_EXTRACTION_DEFAULTS.defaultsVersion);
    });
  });
});
