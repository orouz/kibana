/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';
import { buildRouteValidationWithZod } from '@kbn/zod-helpers/v4';
import type { IKibanaResponse } from '@kbn/core-http-server';
import { API_VERSIONS, ENTITY_STORE_ROUTES } from '../../../common';
import { DEFAULT_ENTITY_STORE_PERMISSIONS } from '../constants';
import type { EntityStoreCoreSetup, EntityStorePluginRouter } from '../../types';
import { wrapMiddlewares } from '../middleware';

const querySchema = z.object({
  index: z.string().default('*'),
  size: z.coerce.number().default(10),
});

export function registerCpsSearch(
  router: EntityStorePluginRouter,
  coreSetup: EntityStoreCoreSetup
) {
  router.versioned
    .get({
      path: ENTITY_STORE_ROUTES.internal.CPS_SEARCH,
      access: 'internal',
      summary: 'CPS search',
      description: 'Search an index using the CPS space-scoped ES client.',
      security: {
        authz: DEFAULT_ENTITY_STORE_PERMISSIONS,
      },
      enableQueryVersion: true,
    })
    .addVersion(
      {
        version: API_VERSIONS.internal.v2,
        validate: {
          request: {
            query: buildRouteValidationWithZod(querySchema),
          },
        },
      },
      wrapMiddlewares(async (ctx, req, res): Promise<IKibanaResponse> => {
        const { index, size } = req.query;
        const [coreStart] = await coreSetup.getStartServices();

        const cpsClient = coreStart.elasticsearch.client.asScoped(req, {
          projectRouting: 'space',
        }).asCurrentUser;

        const result = await cpsClient.search({
          index,
          size,
          project_routing: '_alias:*',
        });

        return res.ok({
          body: {
            total: result.hits.total,
            hits: result.hits.hits,
          },
        });
      })
    );
}
