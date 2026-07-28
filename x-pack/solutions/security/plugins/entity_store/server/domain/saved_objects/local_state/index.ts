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
import type { EntityType } from '../../../../common';
import {
  CURRENT_LOG_EXTRACTION_DEFAULTS_VERSION,
  type StoredLogsExtraction,
} from '../global_state/constants';
import { EntityStoreLocalState } from './constants';
import { EntityStoreLocalStateTypeName } from './types';

export class EntityStoreLocalStateClient {
  constructor(
    private readonly soClient: SavedObjectsClientContract,
    private readonly namespace: string,
    private readonly logger: Logger
  ) {}

  async find(entityType: EntityType): Promise<EntityStoreLocalState | undefined> {
    const response = await this.findSO(entityType);
    if (response.total === 0) {
      return undefined;
    }
    return EntityStoreLocalState.parse(response.saved_objects[0].attributes);
  }

  async findOrThrow(entityType: EntityType): Promise<EntityStoreLocalState> {
    const state = await this.find(entityType);
    if (state === undefined) {
      throw SavedObjectsErrorHelpers.createGenericNotFoundError(
        `No local state found for entity type ${entityType}`
      );
    }
    return state;
  }

  async upsert(
    entityType: EntityType,
    logsExtraction: StoredLogsExtraction
  ): Promise<EntityStoreLocalState> {
    const existing = await this.findSO(entityType);
    const attributes = EntityStoreLocalState.parse({ type: entityType, logsExtraction });
    const id = this.getSavedObjectId(entityType);

    if (existing.total === 0) {
      this.logger.debug(`Creating local state with id ${id}`);
      const { attributes: created } = await this.soClient.create<EntityStoreLocalState>(
        EntityStoreLocalStateTypeName,
        attributes,
        { id, refresh: 'wait_for' }
      );
      return created;
    }

    const { attributes: updated } = await this.soClient.update<EntityStoreLocalState>(
      EntityStoreLocalStateTypeName,
      id,
      attributes,
      { refresh: 'wait_for', mergeAttributes: false }
    );
    return EntityStoreLocalState.parse({
      type: entityType,
      logsExtraction: updated.logsExtraction ?? logsExtraction,
    });
  }

  async ensureExists(entityType: EntityType): Promise<void> {
    const existing = await this.find(entityType);
    if (existing !== undefined) {
      return;
    }
    await this.upsert(entityType, {
      defaultsVersion: CURRENT_LOG_EXTRACTION_DEFAULTS_VERSION,
    });
  }

  async delete(entityType: EntityType): Promise<void> {
    const response = await this.findSO(entityType);
    if (response.total === 0) {
      return;
    }
    try {
      const id = response.saved_objects[0].id;
      this.logger.debug(`Deleting local state with id ${id}`);
      await this.soClient.delete(EntityStoreLocalStateTypeName, id);
    } catch (error) {
      if (Boom.isBoom(error, 404)) {
        return;
      }
      throw error;
    }
  }

  async deleteAll(): Promise<void> {
    const { saved_objects: objects } = await this.soClient.find<EntityStoreLocalState>({
      type: EntityStoreLocalStateTypeName,
      namespaces: [this.namespace],
      perPage: 100,
    });
    await Promise.all(
      objects.map((obj) => this.soClient.delete(EntityStoreLocalStateTypeName, obj.id))
    );
  }

  private getSavedObjectId(entityType: EntityType): string {
    return `${EntityStoreLocalStateTypeName}-${entityType}-${this.namespace}`;
  }

  private findSO(entityType: EntityType): Promise<SavedObjectsFindResponse<EntityStoreLocalState>> {
    return this.soClient.find<EntityStoreLocalState>({
      type: EntityStoreLocalStateTypeName,
      filter: `${EntityStoreLocalStateTypeName}.attributes.type: ${entityType}`,
      namespaces: [this.namespace],
      perPage: 1,
    });
  }
}
