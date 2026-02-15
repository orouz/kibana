/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { EventTypeOpts } from '@kbn/core/public';

export enum EntityStoreEventTypes {
  EntityStoreEnablementToggleClicked = 'Entity Store Enablement Toggle Clicked',
}

export interface EntityStoreEnablementParams {
  timestamp: string;
  action: 'start' | 'stop';
}

export const entityStoreEnablementEvent: EventTypeOpts<EntityStoreEnablementParams> = {
  eventType: EntityStoreEventTypes.EntityStoreEnablementToggleClicked,
  schema: {
    timestamp: {
      type: 'date',
      _meta: {
        description: 'Timestamp of the event',
        optional: false,
      },
    },
    action: {
      type: 'keyword',
      _meta: {
        description: 'Event toggle action',
        optional: false,
      },
    },
  },
};

export const clientTelemetryEvents = [entityStoreEnablementEvent];
