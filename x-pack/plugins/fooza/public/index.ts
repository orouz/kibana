import './index.scss';

import { FoozaPlugin } from './plugin';

// This exports static code and TypeScript types,
// as well as, Kibana Platform `plugin()` initializer.
export function plugin() {
  return new FoozaPlugin();
}
export { FoozaPluginSetup, FoozaPluginStart } from './types';
