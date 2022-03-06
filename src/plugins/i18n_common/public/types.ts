import { NavigationPublicPluginStart } from '../../navigation/public';

export interface I18nCommonPluginSetup {
  getGreeting: () => string;
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface I18nCommonPluginStart {}

export interface AppPluginStartDependencies {
  navigation: NavigationPublicPluginStart;
}
