/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger } from '@kbn/logging';
import type { ElasticsearchClient } from '@kbn/core/server';
import { RemoteLogsExtractionClient } from './remote_logs_extraction_client';
import {
  createCcsStrategy,
  createCpsStrategy,
  type RemoteLogExtractionStateClient,
} from './strategies';

interface CreateRemoteLogsExtractionClientOpts {
  logger: Logger;
  namespace: string;
  /** Regular ES client used by the CCS strategy. */
  esClient: ElasticsearchClient;
  /** Already scoped with `asScoped(req, { projectRouting: 'space' })`. Used by the CPS strategy. */
  cpsClient: ElasticsearchClient;
  ccsStateClient: RemoteLogExtractionStateClient;
  cpsStateClient: RemoteLogExtractionStateClient;
  isServerless: boolean;
}

/**
 * Pick the right remote-extraction strategy for the current deployment:
 *  - serverless → CPS
 *  - stateful   → CCS
 *
 * Mutually exclusive: a deployment is one or the other. Always returns a
 * client; the umbrella short-circuits cleanly if the strategy produces an
 * empty pattern list at runtime (e.g. CCS with no remotes configured).
 */
export function createRemoteLogsExtractionClient({
  logger,
  namespace,
  esClient,
  cpsClient,
  ccsStateClient,
  cpsStateClient,
  isServerless,
}: CreateRemoteLogsExtractionClientOpts): RemoteLogsExtractionClient {
  const strategy = isServerless
    ? createCpsStrategy(cpsClient, cpsStateClient)
    : createCcsStrategy(esClient, ccsStateClient);

  return new RemoteLogsExtractionClient(logger, namespace, strategy);
}
