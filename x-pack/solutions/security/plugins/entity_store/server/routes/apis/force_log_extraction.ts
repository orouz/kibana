/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { buildRouteValidationWithZod } from '@kbn/zod-helpers';
import { z } from '@kbn/zod';
import type { IKibanaResponse } from '@kbn/core-http-server';
import { API_VERSIONS, DEFAULT_ENTITY_STORE_PERMISSIONS } from '../constants';
import type { EntityStorePluginRouter } from '../../types';
import { wrapMiddlewares } from '../middleware';
import { EntityType } from '../../../common/domain/definitions/entity_schema';
import { ENTITY_STORE_API_CALL_EVENT } from '../../telemetry';

const paramsSchema = z.object({
  entityType: EntityType,
});

const bodySchema = z.object({
  fromDateISO: z.string().datetime(),
  toDateISO: z.string().datetime(),
});

export function registerForceLogExtraction(router: EntityStorePluginRouter) {
  router.versioned
    .post({
      path: '/internal/security/entity-store/{entityType}/force-log-extraction',
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
            params: buildRouteValidationWithZod(paramsSchema),
            body: buildRouteValidationWithZod(bodySchema),
          },
        },
      },
      wrapMiddlewares(async (ctx, req, res): Promise<IKibanaResponse> => {
        const entityStoreCtx = await ctx.entityStore;
        const { logger: baseLogger, logsExtractionClient, telemetry } = entityStoreCtx;
        const { entityType } = req.params;

        const logger = baseLogger.get('forceLogExtraction').get(entityType);
        logger.debug(`Force log extraction API called for entity type: ${entityType}`);

        try {
          const summary = await logsExtractionClient.extractLogs(entityType, {
            specificWindow: req.body,
          });

          telemetry.reportEvent(ENTITY_STORE_API_CALL_EVENT, {
            endpoint: req.route.path,
          });

          return res.ok({
            body: summary,
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
