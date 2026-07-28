/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { SavedObjectsErrorHelpers } from '@kbn/core/server';
import Boom from '@hapi/boom';

const isConflict = (error: unknown): boolean =>
  SavedObjectsErrorHelpers.isConflictError(error) || Boom.isBoom(error, 409);

/** Runs `fn`, retrying only on a saved-object version conflict (a concurrent write); other errors fail fast. */
export const retryOnConflict = async <T>(
  fn: () => Promise<T>,
  retries: number = 5
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isConflict(error) || attempt === retries) {
        throw error;
      }
    }
  }
  throw lastError;
};
