/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient } from '@kbn/core/server';
import type { EntityType } from '../../../../common/domain/definitions/entity_schema';

/**
 * Shared structural shape of the per-strategy state SO clients
 * (`CcsLogExtractionStateClient`, `CpsLogExtractionStateClient`). Both already
 * implement this — no new file required.
 */
export interface RemoteLogExtractionStateClient {
  findOrInit(type: EntityType): Promise<{
    checkpointTimestamp: string | null;
    paginationRecoveryId: string | null;
  }>;
  update(
    type: EntityType,
    state: { checkpointTimestamp?: string | null; paginationRecoveryId?: string | null }
  ): Promise<void>;
  clearRecoveryId(type: EntityType): Promise<void>;
}

/**
 * A remote extraction strategy describes how a single remote-data source plugs
 * into the shared extract-to-updates loop. Each strategy supplies its own ES
 * client (already scoped for routing semantics), its own state SO client, and
 * a function that picks the right index patterns for the remote scope.
 *
 * The shared umbrella client is strategy-agnostic — all CCS- or CPS-specific
 * behaviour lives in one of these objects.
 */
export interface RemoteExtractionStrategy {
  /** Stable identifier used in logs and telemetry. */
  readonly id: 'ccs' | 'cps';
  /** ES client already scoped for the strategy (e.g. CPS uses `projectRouting: 'space'`). */
  readonly client: ElasticsearchClient;
  /** State SO client for resume-on-next-tick. */
  readonly stateClient: RemoteLogExtractionStateClient;
  /**
   * Pick the patterns this strategy should send to ES. Receives both:
   * - `localIndexPatterns`: the entity_store's resolved local patterns.
   * - `remoteIndexPatterns`: user-configured patterns that already include a
   *   cluster prefix (`cluster1:logs-*`).
   *
   * Each strategy uses whichever it needs:
   * - CCS: returns `remoteIndexPatterns` unchanged.
   * - CPS: appends `-_origin:*` to `localIndexPatterns`; relies on
   *   `projectRouting: 'space'` on the client for the linked-project scope.
   */
  buildPatterns(args: { localIndexPatterns: string[]; remoteIndexPatterns: string[] }): string[];
}

/** Append-only negation that excludes everything on the origin project from the CPS scope. */
const EXCLUDED_ORIGIN = '-_origin:*' as const;

export const createCcsStrategy = (
  esClient: ElasticsearchClient,
  stateClient: RemoteLogExtractionStateClient
): RemoteExtractionStrategy => ({
  id: 'ccs',
  client: esClient,
  stateClient,
  buildPatterns: ({ remoteIndexPatterns }) => remoteIndexPatterns,
});

export const createCpsStrategy = (
  cpsClient: ElasticsearchClient,
  stateClient: RemoteLogExtractionStateClient
): RemoteExtractionStrategy => ({
  id: 'cps',
  client: cpsClient,
  stateClient,
  buildPatterns: ({ localIndexPatterns }) => [...localIndexPatterns, EXCLUDED_ORIGIN],
});
