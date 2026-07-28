/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger } from '@kbn/logging';
import type { ElasticsearchClient, KibanaRequest } from '@kbn/core/server';
import type { EntityStoreCoreSetup } from '../types';
import { AssetManagerClient } from '../domain/asset_manager';
import { LogsExtractionClient } from '../domain/logs_extraction';
import { createRemoteLogsExtractionClient } from '../domain/logs_extraction/remote';
import { HistorySnapshotClient } from '../domain/history_snapshot';
import {
  EngineDescriptorClient,
  EntityStoreGlobalStateClient,
  EntityStoreLocalStateClient,
  type RemoteLogExtractionStateClient,
} from '../domain/saved_objects';
import type { TelemetryReporter } from '../telemetry/events';

export interface LogsExtractionClientFactoryResult {
  logsExtractionClient: LogsExtractionClient;
  /** Exposed so AssetManager can reuse the same instance for uninstall cleanup. */
  remoteLogExtractionStateClient: RemoteLogExtractionStateClient;
  globalStateClient: EntityStoreGlobalStateClient;
}

export interface AssetManagerClientFactoryResult {
  assetManagerClient: AssetManagerClient;
  esClient: ElasticsearchClient;
}

export async function createLogsExtractionClient({
  core,
  fakeRequest,
  logger,
  namespace,
  isServerless,
  globalStateClient: sharedGlobalStateClient,
}: {
  core: EntityStoreCoreSetup;
  logger: Logger;
  namespace: string;
  fakeRequest: KibanaRequest;
  isServerless: boolean;
  /** Optional shared global SO client (same instance as HistorySnapshotClient). */
  globalStateClient?: EntityStoreGlobalStateClient;
}): Promise<LogsExtractionClientFactoryResult> {
  const [coreStart, pluginsStart] = await core.getStartServices();

  const soClient = coreStart.savedObjects.getScopedClient(fakeRequest);
  const internalUserClient = coreStart.elasticsearch.client.asInternalUser;

  const dataViewsService = await pluginsStart.dataViews.dataViewsServiceFactory(
    soClient,
    internalUserClient,
    fakeRequest
  );

  const esClient = coreStart.elasticsearch.client.asScoped(fakeRequest).asCurrentUser;
  const cpsClient = coreStart.elasticsearch.client.asScoped(fakeRequest, {
    projectRouting: 'space',
  }).asCurrentUser;

  const { client: remoteLogsExtractionClient, stateClient: remoteLogExtractionStateClient } =
    createRemoteLogsExtractionClient({
      logger,
      namespace,
      soClient,
      esClient,
      cpsClient,
      isServerless,
    });

  const engineDescriptorClient = new EngineDescriptorClient(soClient, namespace, logger);
  const globalStateClient =
    sharedGlobalStateClient ?? new EntityStoreGlobalStateClient(soClient, namespace, logger);
  const localStateClient = new EntityStoreLocalStateClient(soClient, namespace, logger);

  const logsExtractionClient = new LogsExtractionClient({
    logger,
    namespace,
    esClient,
    dataViewsService,
    engineDescriptorClient,
    globalStateClient,
    localStateClient,
    remoteLogsExtractionClient,
  });

  return {
    logsExtractionClient,
    remoteLogExtractionStateClient,
    globalStateClient,
  };
}

export async function createAssetManagerClient({
  core,
  fakeRequest,
  logger,
  namespace,
  analytics,
  isServerless = false,
}: {
  core: EntityStoreCoreSetup;
  logger: Logger;
  namespace: string;
  fakeRequest: KibanaRequest;
  analytics: TelemetryReporter;
  isServerless?: boolean;
}): Promise<AssetManagerClientFactoryResult> {
  const [coreStart, pluginsStart] = await core.getStartServices();

  const esClient = coreStart.elasticsearch.client.asScoped(fakeRequest).asCurrentUser;
  const soClient = coreStart.savedObjects.getScopedClient(fakeRequest);
  const engineDescriptorClient = new EngineDescriptorClient(soClient, namespace, logger);
  const globalStateClient = new EntityStoreGlobalStateClient(soClient, namespace, logger);

  const historySnapshotClient = new HistorySnapshotClient({
    logger,
    esClient,
    namespace,
    globalStateClient,
  });

  const { logsExtractionClient, remoteLogExtractionStateClient } = await createLogsExtractionClient(
    {
      core,
      fakeRequest,
      logger,
      namespace,
      isServerless,
      globalStateClient,
    }
  );

  return {
    esClient,
    assetManagerClient: new AssetManagerClient({
      logger,
      esClient,
      internalEsClient: coreStart.elasticsearch.client.asInternalUser,
      taskManager: pluginsStart.taskManager,
      engineDescriptorClient,
      historySnapshotClient,
      remoteLogExtractionStateClient,
      namespace,
      isServerless,
      logsExtractionClient,
      security: pluginsStart.security,
      analytics,
      savedObjectsClient: soClient,
    }),
  };
}
