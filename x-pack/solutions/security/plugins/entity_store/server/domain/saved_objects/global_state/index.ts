/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  SavedObjectsClientContract,
  SavedObjectsFindResponse,
} from '@kbn/core-saved-objects-api-server';
import { SavedObjectsErrorHelpers, type Logger } from '@kbn/core/server';
import Boom from '@hapi/boom';
import {
  EntityStoreGlobalState,
  HistorySnapshotState,
  LogExtractionConfig,
  GLOBAL_DEFAULTS,
  LATEST_DEFAULTS,
  isLogExtractionConfigVersion,
} from './constants';
import { EntityStoreGlobalStateTypeName } from './types';

/** Fill latest defaults and pin `defaultsVersion` to LATEST for persistence. */
const getConfigWithLatestDefaults = (
  config: Partial<LogExtractionConfig> = {}
): LogExtractionConfig =>
  LogExtractionConfig.parse({
    ...config,
    defaultsVersion: LATEST_DEFAULTS.defaultsVersion,
  });

export class EntityStoreGlobalStateClient {
  constructor(
    private readonly soClient: SavedObjectsClientContract,
    private readonly namespace: string,
    private readonly logger: Logger
  ) {}

  async find(): Promise<EntityStoreGlobalState | undefined> {
    const response = await this.findSO();
    if (response.total === 0) {
      return undefined;
    }

    return this.resolveGlobalState(response.saved_objects[0].attributes);
  }

  async findOrThrow(): Promise<EntityStoreGlobalState> {
    const response = await this.find();
    if (response === undefined) {
      throw SavedObjectsErrorHelpers.createGenericNotFoundError(
        'No global state found for this namespace'
      );
    }
    return response;
  }

  async init(initialState?: Partial<EntityStoreGlobalState>): Promise<EntityStoreGlobalState> {
    const existing = await this.find();
    if (existing !== undefined) {
      return this.updateInternal(this.getSavedObjectId(), initialState ?? {}, existing);
    }

    const id = this.getSavedObjectId();
    this.logger.debug(`Creating global state with id ${id}`);

    const historySnapshot = HistorySnapshotState.parse(initialState?.historySnapshot ?? {});
    const logsExtraction = getConfigWithLatestDefaults(initialState?.logsExtraction);
    const parsed = EntityStoreGlobalState.parse({
      historySnapshot,
      logsExtraction,
    });

    await this.soClient.create<EntityStoreGlobalState>(EntityStoreGlobalStateTypeName, parsed, {
      id,
    });

    return parsed;
  }

  async update(partial: Partial<EntityStoreGlobalState>): Promise<EntityStoreGlobalState> {
    const existing = await this.findOrThrow();
    return this.updateInternal(this.getSavedObjectId(), partial, existing);
  }

  private async updateInternal(
    id: string,
    partial: Partial<EntityStoreGlobalState>,
    existing: EntityStoreGlobalState
  ): Promise<EntityStoreGlobalState> {
    const toWrite: Partial<EntityStoreGlobalState> = {};

    if (partial.historySnapshot !== undefined) {
      toWrite.historySnapshot = HistorySnapshotState.parse({
        ...existing.historySnapshot,
        ...partial.historySnapshot,
      });
    }

    if (partial.logsExtraction !== undefined) {
      // Persist the merged effective config pinned to the current latest defaults.
      toWrite.logsExtraction = getConfigWithLatestDefaults({
        ...existing.logsExtraction,
        ...partial.logsExtraction,
      });
    }

    await this.soClient.update<EntityStoreGlobalState>(
      EntityStoreGlobalStateTypeName,
      id,
      toWrite,
      {
        refresh: 'wait_for',
        mergeAttributes: true,
      }
    );

    return {
      historySnapshot: toWrite.historySnapshot ?? existing.historySnapshot,
      logsExtraction: toWrite.logsExtraction ?? existing.logsExtraction,
    };
  }

  async delete(): Promise<void> {
    const response = await this.findSO();
    if (response.total === 0) {
      return;
    }

    try {
      const id = response.saved_objects[0].id;
      this.logger.debug(`Deleting global state with id ${id}`);
      await this.soClient.delete(EntityStoreGlobalStateTypeName, id);
    } catch (error) {
      if (Boom.isBoom(error, 404)) {
        return;
      }
      throw error;
    }
  }

  private getSavedObjectId(): string {
    return `${EntityStoreGlobalStateTypeName}-${this.namespace}`;
  }

  private findSO(): Promise<SavedObjectsFindResponse<EntityStoreGlobalState>> {
    return this.soClient.find<EntityStoreGlobalState>({
      type: EntityStoreGlobalStateTypeName,
      namespaces: [this.namespace],
      perPage: 1,
    });
  }

  private resolveGlobalState(attributes: EntityStoreGlobalState): EntityStoreGlobalState {
    // Apply zod defaults to the persisted attributes so that fields added in newer Kibana
    // versions (e.g. `maxTimeWindowSize`) are populated for SOs that were written before the
    // field existed. This avoids `undefined` reaching consumers like `parseDurationToMs`.
    return EntityStoreGlobalState.parse({
      historySnapshot: attributes.historySnapshot,
      // Drops fields equal to the stored defaults pin so .parse can fill in latest defaults
      // while keeping true overrides.
      logsExtraction: this.getLogExtractionConfigOverrides(attributes.logsExtraction),
    });
  }

  private getLogExtractionConfigOverrides(
    config: LogExtractionConfig
  ): Partial<LogExtractionConfig> {
    if (!isLogExtractionConfigVersion(config.defaultsVersion)) {
      this.logger.warn(
        `Unknown log extraction config defaults version ${config.defaultsVersion}. Preserving persisted values.`
      );
      // Treat every persisted field as an override so we do not wipe user config.
      return config;
    }
    const configDefaults = GLOBAL_DEFAULTS[config.defaultsVersion];
    const overrides = Object.keys(configDefaults).reduce((acc, key) => {
      const configValue = config[key as keyof typeof config];
      const configDefaultValue = configDefaults[key as keyof typeof configDefaults];
      if (configValue !== undefined && configValue !== configDefaultValue) {
        acc[key as keyof typeof acc] = configValue as never;
      }
      return acc;
    }, {} as Partial<LogExtractionConfig>);

    return overrides;
  }
}
