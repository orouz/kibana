/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import ReactDOM from 'react-dom';
import React from 'react';
import * as Rx from 'rxjs';
import { I18nProvider } from '@kbn/i18n-react';
import {
  CoreSetup,
  CoreStart,
  Plugin,
  CoreTheme,
  ApplicationStart,
  HttpStart,
  PluginInitializerContext,
} from '@kbn/core/public';

import { KibanaThemeProvider } from '@kbn/kibana-react-plugin/public';
import {
  ClientConfigType,
  GuidedOnboardingPluginSetup,
  GuidedOnboardingPluginStart,
} from './types';
import { GuidedOnboardingButton } from './components';
import { ApiService, apiService } from './services/api';

export class GuidedOnboardingPlugin
  implements Plugin<GuidedOnboardingPluginSetup, GuidedOnboardingPluginStart>
{
  constructor(private ctx: PluginInitializerContext) {}
  public setup(core: CoreSetup): GuidedOnboardingPluginSetup {
    return {};
  }

  public start(core: CoreStart): GuidedOnboardingPluginStart {
    const { ui: isGuidedOnboardingUiEnabled } = this.ctx.config.get<ClientConfigType>();
    if (!isGuidedOnboardingUiEnabled) {
      return {};
    }

    const { chrome, http, theme, application } = core;

    // Initialize services
    apiService.setup(http);

    chrome.navControls.registerExtension({
      order: 1000,
      mount: (target) =>
        this.mount({
          targetDomElement: target,
          theme$: theme.theme$,
          api: apiService,
          application,
          http,
        }),
    });

    // Return methods that should be available to other plugins
    return {
      guidedOnboardingApi: apiService,
    };
  }

  public stop() {}

  private mount({
    targetDomElement,
    theme$,
    api,
    application,
    http,
  }: {
    targetDomElement: HTMLElement;
    theme$: Rx.Observable<CoreTheme>;
    api: ApiService;
    application: ApplicationStart;
    http: HttpStart;
  }) {
    ReactDOM.render(
      <KibanaThemeProvider theme$={theme$}>
        <I18nProvider>
          <GuidedOnboardingButton api={api} application={application} http={http} />
        </I18nProvider>
      </KibanaThemeProvider>,
      targetDomElement
    );
    return () => ReactDOM.unmountComponentAtNode(targetDomElement);
  }
}
