/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { buildRouteValidationWithZod } from '@kbn/zod-helpers';
import { z } from '@kbn/zod';
import { ENTITY_STORE_ROUTES } from '../../../common';
import { API_VERSIONS, DEFAULT_ENTITY_STORE_PERMISSIONS } from '../constants';
import type { EntityStorePluginRouter } from '../../types';
import { ALL_ENTITY_TYPES, EntityType } from '../../../common/domain/definitions/entity_schema';
import { wrapMiddlewares } from '../middleware';
import { ENTITY_STORE_API_CALL_EVENT } from '../../telemetry';

const bodySchema = z.object({
  entityTypes: z.array(EntityType).optional().default(ALL_ENTITY_TYPES),
});

export function registerUninstall(router: EntityStorePluginRouter) {
  router.versioned
    .post({
      path: ENTITY_STORE_ROUTES.UNINSTALL,
      access: 'internal',
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
            body: buildRouteValidationWithZod(bodySchema),
          },
        },
      },
      wrapMiddlewares(async (ctx, req, res) => {
        const { logger, assetManager, telemetry } = await ctx.entityStore;
        logger.debug(`uninstalling entities: [${req.body.entityTypes.join(', ')}]`);

        try {
          await Promise.all(req.body.entityTypes.map((type) => assetManager.uninstall(type)));

          telemetry.reportEvent(ENTITY_STORE_API_CALL_EVENT, {
            endpoint: req.route.path,
          });

          return res.ok({
            body: {
              ok: true,
            },
          });
        } catch (e) {
          telemetry.reportEvent(ENTITY_STORE_API_CALL_EVENT, {
            endpoint: req.route.path,
            error: e instanceof Error ? e.message : String(e),
          });
          throw e;
        }
      })
    );
}
