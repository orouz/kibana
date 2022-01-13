import './index.scss';

import { CloudSecurityPosturePlugin } from './plugin';

// This exports static code and TypeScript types,
// as well as, Kibana Platform `plugin()` initializer.
export function plugin() {
  return new CloudSecurityPosturePlugin();
}
export { CloudSecurityPosturePluginSetup, CloudSecurityPosturePluginStart } from './types';
