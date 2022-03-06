import './index.scss';

import { I18nCommonPlugin } from './plugin';

// This exports static code and TypeScript types,
// as well as, Kibana Platform `plugin()` initializer.
export function plugin() {
  return new I18nCommonPlugin();
}
export { I18nCommonPluginSetup, I18nCommonPluginStart } from './types';
