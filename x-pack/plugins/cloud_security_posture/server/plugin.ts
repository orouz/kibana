import {
  PluginInitializerContext,
  CoreSetup,
  CoreStart,
  Plugin,
  Logger,
} from '../../../../src/core/server';

import { CloudSecurityPosturePluginSetup, CloudSecurityPosturePluginStart } from './types';
import { defineRoutes } from './routes';

export class CloudSecurityPosturePlugin
  implements Plugin<CloudSecurityPosturePluginSetup, CloudSecurityPosturePluginStart>
{
  private readonly logger: Logger;

  constructor(initializerContext: PluginInitializerContext) {
    this.logger = initializerContext.logger.get();
  }

  public setup(core: CoreSetup) {
    this.logger.debug('cloudSecurityPosture: Setup');
    const router = core.http.createRouter();

    // Register server side APIs
    defineRoutes(router);

    return {};
  }

  public start(core: CoreStart) {
    this.logger.debug('cloudSecurityPosture: Started');
    return {};
  }

  public stop() {}
}
