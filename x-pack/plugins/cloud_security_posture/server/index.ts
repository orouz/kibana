import { PluginInitializerContext } from '../../../../src/core/server';
import { CloudSecurityPosturePlugin } from './plugin';

//  This exports static code and TypeScript types,
//  as well as, Kibana Platform `plugin()` initializer.

export function plugin(initializerContext: PluginInitializerContext) {
  return new CloudSecurityPosturePlugin(initializerContext);
}

export { CloudSecurityPosturePluginSetup, CloudSecurityPosturePluginStart } from './types';
