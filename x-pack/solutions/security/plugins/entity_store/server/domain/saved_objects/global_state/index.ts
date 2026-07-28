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
import type { StoredLogsExtraction } from './constants';
import {
  EntityStoreGlobalState,
  HistorySnapshotState,
  toStoredGlobalLogsExtraction,
} from './constants';
import { EntityStoreGlobalStateTypeName } from './types';

const REPLACE_MAX_ATTEMPTS = 5;

/**
 * Persistence for the entity-store global SO (historySnapshot + logsExtraction shell).
 *
 * Do not write `logsExtraction` from here except via {@link updateLogsExtraction} —
 * that path is reserved for {@link LogExtractionStateManager}.
 *
 * Create / field updates are race-safe so HistorySnapshotClient and LogsExtractionClient
 * can init in parallel without coordinating order.
 */
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
    return EntityStoreGlobalState.parse(response.saved_objects[0].attributes);
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

  /**
   * Idempotent: return existing SO or create one with default history + empty sparse logs shell.
   * Concurrent creates resolve via conflict → re-find.
   */
  async ensureExists(): Promise<EntityStoreGlobalState> {
    const existing = await this.find();
    if (existing !== undefined) {
      return existing;
    }

    const id = this.getSavedObjectId();
    this.logger.debug(`Creating global state with id ${id}`);

    const historySnapshot = HistorySnapshotState.parse({});
    const logsExtraction = toStoredGlobalLogsExtraction({});
    const parsed = EntityStoreGlobalState.parse({ historySnapshot, logsExtraction });

    try {
      const { attributes } = await this.soClient.create<EntityStoreGlobalState>(
        EntityStoreGlobalStateTypeName,
        parsed,
        { id, refresh: 'wait_for' }
      );
      return attributes;
    } catch (error) {
      if (SavedObjectsErrorHelpers.isConflictError(error) || Boom.isBoom(error, 409)) {
        return this.findOrThrow();
      }
      throw error;
    }
  }

  /**
   * Idempotent history upsert. Ensures the SO exists; never touches logsExtraction.
   */
  async init(
    initialState?: Partial<{
      historySnapshot: EntityStoreGlobalState['historySnapshot'];
    }>
  ): Promise<EntityStoreGlobalState> {
    await this.ensureExists();
    if (initialState?.historySnapshot === undefined) {
      return this.findOrThrow();
    }
    return this.updateHistorySnapshot(initialState.historySnapshot);
  }

  async updateHistorySnapshot(
    historySnapshot: EntityStoreGlobalState['historySnapshot']
  ): Promise<EntityStoreGlobalState> {
    await this.ensureExists();
    return this.replaceAttributes({ historySnapshot });
  }

  /** Reserved for LogExtractionStateManager — pass an already-sparse stored shape. */
  async updateLogsExtraction(logsExtraction: StoredLogsExtraction): Promise<EntityStoreGlobalState> {
    await this.ensureExists();
    return this.replaceAttributes({ logsExtraction });
  }

  /** Idempotent: no-op when missing. */
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
      if (Boom.isBoom(error, 404) || SavedObjectsErrorHelpers.isNotFoundError(error)) {
        return;
      }
      throw error;
    }
  }

  private async replaceAttributes(partial: {
    historySnapshot?: EntityStoreGlobalState['historySnapshot'];
    logsExtraction?: StoredLogsExtraction;
  }): Promise<EntityStoreGlobalState> {
    let lastError: unknown;
    for (let attempt = 0; attempt < REPLACE_MAX_ATTEMPTS; attempt++) {
      try {
        const { id, attributes, version } = await this.findSOOrThrow();
        const next: EntityStoreGlobalState = {
          historySnapshot: partial.historySnapshot ?? attributes.historySnapshot,
          logsExtraction: partial.logsExtraction ?? attributes.logsExtraction,
        };
        const parsed = EntityStoreGlobalState.parse(next);

        await this.soClient.update<EntityStoreGlobalState>(
          EntityStoreGlobalStateTypeName,
          id,
          parsed,
          {
            refresh: 'wait_for',
            mergeAttributes: false,
            version,
          }
        );

        return parsed;
      } catch (error) {
        lastError = error;
        // Parallel history + logs field updates can race on SO version.
        if (SavedObjectsErrorHelpers.isConflictError(error) || Boom.isBoom(error, 409)) {
          continue;
        }
        throw error;
      }
    }
    throw lastError;
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

  private async findSOOrThrow() {
    const response = await this.findSO();
    if (response.total === 0) {
      throw SavedObjectsErrorHelpers.createGenericNotFoundError(
        'No global state found for this namespace'
      );
    }
    return response.saved_objects[0];
  }
}
