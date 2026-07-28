/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';
import { EntityType } from '../../../../common';
import { StoredLogsExtraction } from '../global_state/constants';

export type EntityStoreLocalState = z.infer<typeof EntityStoreLocalState>;
export const EntityStoreLocalState = z.object({
  type: EntityType,
  logsExtraction: StoredLogsExtraction,
});
