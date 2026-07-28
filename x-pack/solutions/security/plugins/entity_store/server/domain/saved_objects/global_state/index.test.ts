/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { savedObjectsClientMock } from '@kbn/core/server/mocks';
import { loggerMock } from '@kbn/logging-mocks';
import { EntityStoreGlobalStateClient } from '.';
import {
  GLOBAL_LOG_EXTRACTION_DEFAULTS,
  LATEST_LOG_EXTRACTION_DEFAULTS,
  type EntityStoreGlobalState,
} from './constants';
import { EntityStoreGlobalStateTypeName } from './types';

describe('EntityStoreGlobalStateClient', () => {
  const namespace = 'default';
  let soClient: ReturnType<typeof savedObjectsClientMock.create>;
  let logger: ReturnType<typeof loggerMock.create>;
  let client: EntityStoreGlobalStateClient;

  const savedObjectId = `${EntityStoreGlobalStateTypeName}-${namespace}`;

  beforeEach(() => {
    soClient = savedObjectsClientMock.create();
    logger = loggerMock.create();
    client = new EntityStoreGlobalStateClient(soClient, namespace, logger);
  });

  function mockFindAttributes(attributes: EntityStoreGlobalState) {
    soClient.find.mockResolvedValue({
      total: 1,
      saved_objects: [
        {
          id: savedObjectId,
          type: EntityStoreGlobalStateTypeName,
          attributes,
          references: [],
          score: 0,
        },
      ],
      page: 1,
      per_page: 1,
    } as Awaited<ReturnType<typeof soClient.find>>);
  }

  describe('find', () => {
    it('strips values equal to the stored defaults pin and fills latest defaults', async () => {
      mockFindAttributes({
        historySnapshot: { status: 'started', frequency: '24h' },
        logsExtraction: {
          ...GLOBAL_LOG_EXTRACTION_DEFAULTS[1],
          delay: '5m', // user override vs V1 default
        },
      });

      const result = await client.find();

      expect(result?.logsExtraction.delay).toBe('5m');
      expect(result?.logsExtraction.frequency).toBe(LATEST_LOG_EXTRACTION_DEFAULTS.frequency);
      expect(result?.logsExtraction.maxLogsPerPage).toBe(
        LATEST_LOG_EXTRACTION_DEFAULTS.maxLogsPerPage
      );
      expect(result?.logsExtraction.defaultsVersion).toBe(
        LATEST_LOG_EXTRACTION_DEFAULTS.defaultsVersion
      );
    });

    it('preserves field values when defaultsVersion is unknown, but pins to latest', async () => {
      mockFindAttributes({
        historySnapshot: { status: 'started', frequency: '24h' },
        logsExtraction: {
          ...GLOBAL_LOG_EXTRACTION_DEFAULTS[1],
          defaultsVersion: 99,
          delay: '5m',
          frequency: '1m',
          maxLogsPerPage: 50_000,
        },
      });

      const result = await client.find();

      expect(logger.warn).toHaveBeenCalled();
      expect(result?.logsExtraction.delay).toBe('5m');
      expect(result?.logsExtraction.frequency).toBe('1m');
      expect(result?.logsExtraction.maxLogsPerPage).toBe(50_000);
      expect(result?.logsExtraction.defaultsVersion).toBe(
        LATEST_LOG_EXTRACTION_DEFAULTS.defaultsVersion
      );
    });
  });

  describe('init', () => {
    it('creates a new SO pinned to latest defaults', async () => {
      soClient.find.mockResolvedValue({
        total: 0,
        saved_objects: [],
        page: 1,
        per_page: 1,
      } as Awaited<ReturnType<typeof soClient.find>>);
      soClient.create.mockResolvedValue({
        id: savedObjectId,
        type: EntityStoreGlobalStateTypeName,
        attributes: {} as EntityStoreGlobalState,
        references: [],
      } as Awaited<ReturnType<typeof soClient.create>>);

      const result = await client.init({ logsExtraction: { delay: '2m' } });

      expect(soClient.create).toHaveBeenCalledWith(
        EntityStoreGlobalStateTypeName,
        expect.objectContaining({
          logsExtraction: expect.objectContaining({
            delay: '2m',
            frequency: LATEST_LOG_EXTRACTION_DEFAULTS.frequency,
            defaultsVersion: LATEST_LOG_EXTRACTION_DEFAULTS.defaultsVersion,
          }),
        }),
        { id: savedObjectId }
      );
      expect(result.logsExtraction.delay).toBe('2m');
      expect(result.logsExtraction.defaultsVersion).toBe(
        LATEST_LOG_EXTRACTION_DEFAULTS.defaultsVersion
      );
    });

    it('adopts latest defaults when updating an existing SO via init', async () => {
      mockFindAttributes({
        historySnapshot: { status: 'started', frequency: '24h' },
        logsExtraction: {
          ...GLOBAL_LOG_EXTRACTION_DEFAULTS[1],
          delay: '5m',
        },
      });
      soClient.update.mockResolvedValue({
        id: savedObjectId,
        type: EntityStoreGlobalStateTypeName,
        attributes: {},
        references: [],
      } as Awaited<ReturnType<typeof soClient.update>>);

      const result = await client.init({ logsExtraction: { lookbackPeriod: '6h' } });

      expect(soClient.update).toHaveBeenCalledWith(
        EntityStoreGlobalStateTypeName,
        savedObjectId,
        expect.objectContaining({
          logsExtraction: expect.objectContaining({
            delay: '5m',
            lookbackPeriod: '6h',
            frequency: LATEST_LOG_EXTRACTION_DEFAULTS.frequency,
            defaultsVersion: LATEST_LOG_EXTRACTION_DEFAULTS.defaultsVersion,
          }),
        }),
        { refresh: 'wait_for', mergeAttributes: true }
      );
      expect(result.logsExtraction.defaultsVersion).toBe(
        LATEST_LOG_EXTRACTION_DEFAULTS.defaultsVersion
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      mockFindAttributes({
        historySnapshot: { status: 'started', frequency: '24h' },
        logsExtraction: {
          ...GLOBAL_LOG_EXTRACTION_DEFAULTS[1],
          delay: '5m',
        },
      });
      soClient.update.mockResolvedValue({
        id: savedObjectId,
        type: EntityStoreGlobalStateTypeName,
        attributes: {},
        references: [],
      } as Awaited<ReturnType<typeof soClient.update>>);
    });

    it('merges a logsExtraction patch, adopts latest pin, and returns effective config', async () => {
      const result = await client.update({ logsExtraction: { docsLimit: 5000 } });

      expect(soClient.update).toHaveBeenCalledWith(
        EntityStoreGlobalStateTypeName,
        savedObjectId,
        {
          logsExtraction: expect.objectContaining({
            delay: '5m',
            docsLimit: 5000,
            frequency: LATEST_LOG_EXTRACTION_DEFAULTS.frequency,
            defaultsVersion: LATEST_LOG_EXTRACTION_DEFAULTS.defaultsVersion,
          }),
        },
        { refresh: 'wait_for', mergeAttributes: true }
      );
      expect(result.logsExtraction.docsLimit).toBe(5000);
      expect(result.logsExtraction.delay).toBe('5m');
      expect(result.logsExtraction.defaultsVersion).toBe(
        LATEST_LOG_EXTRACTION_DEFAULTS.defaultsVersion
      );
    });

    it('does not rewrite logsExtraction when only historySnapshot is updated', async () => {
      const result = await client.update({
        historySnapshot: { status: 'stopped', frequency: '24h' },
      });

      expect(soClient.update).toHaveBeenCalledWith(
        EntityStoreGlobalStateTypeName,
        savedObjectId,
        {
          historySnapshot: expect.objectContaining({ status: 'stopped' }),
        },
        { refresh: 'wait_for', mergeAttributes: true }
      );
      // Still the resolved-from-find config (V1 pin → latest fill), not rewritten to disk
      expect(result.logsExtraction.delay).toBe('5m');
      expect(result.logsExtraction.defaultsVersion).toBe(
        LATEST_LOG_EXTRACTION_DEFAULTS.defaultsVersion
      );
      expect(soClient.update.mock.calls[0][2]).not.toHaveProperty('logsExtraction');
    });

    it('does not rewrite logsExtraction when an empty logsExtraction patch is provided', async () => {
      const result = await client.update({ logsExtraction: {} });

      expect(soClient.update.mock.calls[0][2]).not.toHaveProperty('logsExtraction');
      expect(result.logsExtraction.delay).toBe('5m');
    });
  });
});
