/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ElasticsearchClient } from '@kbn/core/server';
import { elasticsearchServiceMock } from '@kbn/core/server/mocks';
import { getSLOTransformId } from '../../assets/constants';
import { DeleteSLO } from './delete_slo';
import { createAPMTransactionErrorRateIndicator, createSLO } from './fixtures/slo';
import { createSLORepositoryMock, createTransformManagerMock } from './mocks';
import { SLORepository } from './slo_repository';
import { TransformManager } from './transform_manager';

describe('DeleteSLO', () => {
  let mockRepository: jest.Mocked<SLORepository>;
  let mockTransformManager: jest.Mocked<TransformManager>;
  let mockEsClient: jest.Mocked<ElasticsearchClient>;
  let deleteSLO: DeleteSLO;

  beforeEach(() => {
    mockRepository = createSLORepositoryMock();
    mockTransformManager = createTransformManagerMock();
    mockEsClient = elasticsearchServiceMock.createElasticsearchClient();
    deleteSLO = new DeleteSLO(mockRepository, mockTransformManager, mockEsClient);
  });

  describe('happy path', () => {
    it('removes the transform, the roll up data and the SLO from the repository', async () => {
      const slo = createSLO(createAPMTransactionErrorRateIndicator());
      mockRepository.findById.mockResolvedValueOnce(slo);

      await deleteSLO.execute(slo.id);

      expect(mockTransformManager.stop).toHaveBeenCalledWith(getSLOTransformId(slo.id));
      expect(mockTransformManager.uninstall).toHaveBeenCalledWith(getSLOTransformId(slo.id));
      expect(mockEsClient.deleteByQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            match: {
              'slo.id': slo.id,
            },
          },
        })
      );
      expect(mockRepository.deleteById).toHaveBeenCalledWith(slo.id);
    });
  });
});
