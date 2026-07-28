/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger } from '@kbn/logging';
import type { EntityType } from '../../../common';
import {
  type EntityStoreGlobalStateClient,
  type EntityStoreLocalStateClient,
  type LogExtractionConfig,
  type LogExtractionConfigInput,
  resolveLogExtractionConfig,
  resolveGlobalLogExtractionConfig,
  toStoredGlobalLogsExtraction,
  toStoredLocalLogsExtraction,
  CURRENT_LOG_EXTRACTION_DEFAULTS_VERSION,
} from '../saved_objects';

/**
 * Sole owner of log-extraction config reads/writes on the global + local SOs.
 *
 * Resolved config =
 *   globalDefaults ∪ perTypeDefaults ∪ globalOverrides ∪ localOverrides
 *
 * Empty / omitted `entityTypes` on write → global SO.
 * Non-empty `entityTypes` → per-type local SOs only.
 *
 * Callers must not touch EntityStoreGlobalStateClient / EntityStoreLocalStateClient for
 * `logsExtraction` — only this manager (via LogsExtractionClient).
 */
export class LogExtractionStateManager {
  constructor(
    private readonly logger: Logger,
    private readonly globalStateClient: EntityStoreGlobalStateClient,
    private readonly localStateClient: EntityStoreLocalStateClient
  ) {}

  public async getConfig(entityType: EntityType): Promise<LogExtractionConfig> {
    const globalState = await this.globalStateClient.find();
    const localState = await this.localStateClient.find(entityType);

    return resolveLogExtractionConfig(
      entityType,
      globalState?.logsExtraction ?? { defaultsVersion: CURRENT_LOG_EXTRACTION_DEFAULTS_VERSION },
      localState?.logsExtraction ?? { defaultsVersion: CURRENT_LOG_EXTRACTION_DEFAULTS_VERSION }
    );
  }

  /** Store-wide resolved config (no per-type layer). */
  public async getStoreWideConfig(): Promise<LogExtractionConfig> {
    const globalState = await this.globalStateClient.findOrThrow();
    return resolveGlobalLogExtractionConfig(globalState.logsExtraction);
  }

  /**
   * Idempotent: ensure global SO exists, apply optional install params, ensure local shells.
   * Safe to call in parallel with HistorySnapshotClient.init.
   */
  public async init(
    entityTypes: EntityType[],
    params?: LogExtractionConfigInput
  ): Promise<void> {
    await this.globalStateClient.ensureExists();
    if (params !== undefined && Object.keys(params).length > 0) {
      await this.updateConfig(params);
    }
    await this.ensureLocalStates(entityTypes);
  }

  /**
   * Patch config.
   * - Global write (no `entityTypes`) → sparse overrides on the global SO.
   * - With `entityTypes` → same patch applied as sparse overrides on each local SO.
   *
   * Requires the global SO to exist (call {@link init} first on a fresh store).
   */
  public async updateConfig(
    patch: LogExtractionConfigInput,
    entityTypes?: EntityType[]
  ): Promise<void> {
    const hasTypes = entityTypes !== undefined && entityTypes.length > 0;

    if (!hasTypes) {
      this.logger.debug('Updating global log extraction overrides');
      const globalState = await this.globalStateClient.findOrThrow();
      const stored = toStoredGlobalLogsExtraction(patch, globalState.logsExtraction);
      await this.globalStateClient.updateLogsExtraction(stored);
      return;
    }

    this.logger.debug(
      `Updating log extraction overrides for entity types: ${entityTypes.join(', ')}`
    );

    await Promise.all(
      entityTypes.map(async (type) => {
        const existing = await this.localStateClient.find(type);
        const stored = toStoredLocalLogsExtraction(type, patch, existing?.logsExtraction ?? {});
        await this.localStateClient.upsert(type, stored);
      })
    );
  }

  public async ensureLocalStates(entityTypes: EntityType[]): Promise<void> {
    await Promise.all(entityTypes.map((type) => this.localStateClient.ensureExists(type)));
  }

  public async deleteLocalStates(entityTypes?: EntityType[]): Promise<void> {
    if (entityTypes === undefined) {
      await this.localStateClient.deleteAll();
      return;
    }
    await Promise.all(entityTypes.map((type) => this.localStateClient.delete(type)));
  }
}
