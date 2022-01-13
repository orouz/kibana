import { NavigationPublicPluginStart } from '../../../../src/plugins/navigation/public';

export interface CloudSecurityPosturePluginSetup {
  getGreeting: () => string;
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CloudSecurityPosturePluginStart {}

export interface AppPluginStartDependencies {
  navigation: NavigationPublicPluginStart;
}
