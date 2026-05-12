/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SavedObjectsClientContract } from '@kbn/core-saved-objects-api-server';
import { SavedObjectsErrorHelpers, type Logger } from '@kbn/core/server';
import type { EntityType } from '../../../../common/domain/definitions/entity_schema';
import { CpsLogExtractionState } from './constants';
import { CpsLogExtractionStateTypeName } from './types';

export class CpsLogExtractionStateClient {
  constructor(
    private readonly soClient: SavedObjectsClientContract,
    private readonly namespace: string,
    private readonly logger: Logger
  ) {}

  async findOrInit(entityType: EntityType): Promise<CpsLogExtractionState> {
    const id = this.getSavedObjectId(entityType);
    try {
      const { attributes } = await this.soClient.get<CpsLogExtractionState>(
        CpsLogExtractionStateTypeName,
        id
      );
      return CpsLogExtractionState.parse(attributes);
    } catch (err) {
      if (SavedObjectsErrorHelpers.isNotFoundError(err)) {
        this.logger.debug(`CPS log extraction state not found for ${entityType}, creating default`);
        const defaultState = CpsLogExtractionState.parse({});
        try {
          await this.soClient.create<CpsLogExtractionState>(
            CpsLogExtractionStateTypeName,
            defaultState,
            { id }
          );
          return defaultState;
        } catch (createErr) {
          // A concurrent findOrInit won the race — read and return what it created.
          if (SavedObjectsErrorHelpers.isConflictError(createErr)) {
            const { attributes } = await this.soClient.get<CpsLogExtractionState>(
              CpsLogExtractionStateTypeName,
              id
            );
            return CpsLogExtractionState.parse(attributes);
          }
          throw createErr;
        }
      }
      throw err;
    }
  }

  async update(entityType: EntityType, state: Partial<CpsLogExtractionState>): Promise<void> {
    const id = this.getSavedObjectId(entityType);
    await this.soClient.update<CpsLogExtractionState>(CpsLogExtractionStateTypeName, id, state, {
      refresh: 'wait_for',
      mergeAttributes: true,
    });
  }

  async clearRecoveryId(entityType: EntityType): Promise<void> {
    await this.update(entityType, { paginationRecoveryId: null });
  }

  async delete(entityType: EntityType): Promise<void> {
    const id = this.getSavedObjectId(entityType);
    await this.soClient.delete(CpsLogExtractionStateTypeName, id).catch((err) => {
      if (!SavedObjectsErrorHelpers.isNotFoundError(err)) {
        throw err;
      }
    });
  }

  private getSavedObjectId(entityType: EntityType): string {
    return `${CpsLogExtractionStateTypeName}-${entityType}-${this.namespace}`;
  }
}
