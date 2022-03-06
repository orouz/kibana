import { NavigationPublicPluginStart } from '../../../../src/plugins/navigation/public';

export interface FoozaPluginSetup {
  getGreeting: () => string;
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FoozaPluginStart {}

export interface AppPluginStartDependencies {
  navigation: NavigationPublicPluginStart;
}
