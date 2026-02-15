/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { EventTypeOpts } from '@kbn/core/server';

export const ENTITY_STORE_HEALTH_REPORT_EVENT: EventTypeOpts<{
  engines: Array<{
    type: string;
    status: string;
    delay: string;
    frequency: string;
    docsPerSecond: number;
    lookbackPeriod: string;
    fieldHistoryLength: number;
    indexPattern: string;
    filter: string;
    timestampField: string;
    components: Array<{
      id: string;
      resource: string;
      installed: boolean;
      health?: string;
    }>;
  }>;
}> = {
  eventType: 'entity_store_health_report',
  schema: {
    engines: {
      type: 'array',
      items: {
        properties: {
          type: {
            type: 'keyword',
            _meta: { description: 'Engine type (e.g "host" or "generic")' },
          },
          status: {
            type: 'keyword',
            _meta: {
              description: 'Overall engine status',
            },
          },
          delay: {
            type: 'keyword',
            _meta: {
              description: 'Initial data processing delay (human readable, e.g., "5s")',
            },
          },
          frequency: {
            type: 'keyword',
            _meta: { description: 'Run frequency (e.g., "1m", "15m")' },
          },
          docsPerSecond: {
            type: 'double',
            _meta: { description: 'Indexing rate in documents per second' },
          },
          lookbackPeriod: {
            type: 'keyword',
            _meta: {
              description: 'Lookback period used by the engine (e.g., "7d")',
            },
          },
          fieldHistoryLength: {
            type: 'long',
            _meta: {
              description: 'Number of historical field entries retained',
            },
          },
          indexPattern: {
            type: 'keyword',
            _meta: { description: 'Additional index pattern ingested by the transform' },
          },
          filter: {
            type: 'keyword',
            _meta: {
              description: 'Optional filter applied to ingested documents',
            },
          },
          timestampField: {
            type: 'keyword',
            _meta: {
              description:
                'Name of the timestamp field used for all operations (e.g. "@timestamp")',
            },
          },
          components: {
            type: 'array',
            items: {
              properties: {
                id: {
                  type: 'keyword',
                  _meta: { description: 'Component identifier' },
                },
                resource: {
                  type: 'keyword',
                  _meta: {
                    description: 'Type of the component (e.g. "index" or "transform")',
                  },
                },
                installed: {
                  type: 'boolean',
                  _meta: { description: 'Whether the component is installed' },
                },
                health: {
                  type: 'keyword',
                  _meta: {
                    optional: true,
                    description: 'Reported component health; Present for transforms',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const ENTITY_ENGINE_INITIALIZATION_EVENT: EventTypeOpts<{
  duration: number;
  entityType: string;
  namespace: string;
}> = {
  eventType: 'entity_engine_initialization',
  schema: {
    duration: {
      type: 'long',
      _meta: {
        description: 'Duration (in seconds) of the entity engine initialization',
      },
    },
    entityType: {
      type: 'keyword',
      _meta: {
        description: 'Type of entities stored (e.g. "host")',
      },
    },
    namespace: {
      type: 'keyword',
      _meta: {
        description: 'Namespace where the entities are stored (e.g. "default")',
      },
    },
  },
};

export const ENTITY_ENGINE_RESOURCE_INIT_FAILURE_EVENT: EventTypeOpts<{
  error: string;
}> = {
  eventType: 'entity_engine_resource_init_failure',
  schema: {
    error: {
      type: 'keyword',
      _meta: {
        description: 'Error message for a resource initialization failure',
      },
    },
  },
};

export const ENTITY_ENGINE_DELETION_EVENT: EventTypeOpts<{
  duration: number;
  entityType: string;
  namespace: string;
}> = {
  eventType: 'entity_engine_deletion',
  schema: {
    duration: {
      type: 'long',
      _meta: {
        description: 'Duration (in seconds) of the entity engine deletion',
      },
    },
    entityType: {
      type: 'keyword',
      _meta: {
        description: 'Type of entities stored (e.g. "host")',
      },
    },
    namespace: {
      type: 'keyword',
      _meta: {
        description: 'Namespace where the entities are stored (e.g. "default")',
      },
    },
  },
};

export const ENTITY_STORE_USAGE_EVENT: EventTypeOpts<{
  storeSize: number;
  entityType: string;
  namespace: string;
}> = {
  eventType: 'entity_store_usage',
  schema: {
    storeSize: {
      type: 'long',
      _meta: {
        description: 'Number of entities stored in the entity store by type and namespace',
      },
    },
    entityType: {
      type: 'keyword',
      _meta: {
        description: 'Type of entities stored (e.g. "host")',
      },
    },
    namespace: {
      type: 'keyword',
      _meta: {
        description: 'Namespace where the entities are stored (e.g. "default")',
      },
    },
  },
};

export const ENTITY_STORE_API_CALL_EVENT: EventTypeOpts<{
  endpoint: string;
  error?: string;
}> = {
  eventType: 'entity_store_api_call',
  schema: {
    endpoint: {
      type: 'keyword',
      _meta: {
        description: 'Name of the endpoint called',
      },
    },
    error: {
      type: 'keyword',
      _meta: {
        optional: true,
        description: 'Contains error message in case the call failed',
      },
    },
  },
};

export const ENTITY_HIGHLIGHTS_USAGE_EVENT: EventTypeOpts<{
  entityType: string;
  spaceId: string;
}> = {
  eventType: 'entity_highlights_usage',
  schema: {
    entityType: {
      type: 'keyword',
      _meta: {
        description: 'Type of entity highlights have been request for  (e.g. "host")',
      },
    },
    spaceId: {
      type: 'keyword',
      _meta: {
        description: 'Space where the highlight request originated (e.g. "default")',
      },
    },
  },
};

export const serverTelemetryEvents = [
  ENTITY_STORE_HEALTH_REPORT_EVENT,
  ENTITY_ENGINE_INITIALIZATION_EVENT,
  ENTITY_ENGINE_RESOURCE_INIT_FAILURE_EVENT,
  ENTITY_ENGINE_DELETION_EVENT,
  ENTITY_STORE_USAGE_EVENT,
  ENTITY_STORE_API_CALL_EVENT,
  ENTITY_HIGHLIGHTS_USAGE_EVENT,
];
