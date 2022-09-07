/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { FtrProviderContext } from '../../ftr_provider_context';

export default function ({ getService }: FtrProviderContext) {
  const kibanaServer = getService('kibanaServer');
  const cloudPosture = getService('cloudPosture');
  const esArchiver = getService('esArchiver');

  describe('Benchmarks Page', () => {
    before(async () => {
      await kibanaServer.savedObjects.cleanStandardList();
      await esArchiver.load('x-pack/test/functional/es_archives/fleet/agents');
      await cloudPosture.fleet.installIntegration();
    });
    after(async () => {
      await kibanaServer.savedObjects.cleanStandardList();
      await esArchiver.unload('x-pack/test/functional/es_archives/fleet/agents');
    });

    /**
     * await esArchiver.load('x-pack/test/functional/es_archives/csp/k8s_eks');
     * await esArchiver.load('x-pack/test/functional/es_archives/csp/k8s_managed');
     * await esArchiver.load('x-pack/test/functional/es_archives/csp/findings');
     *
     * kibanaServer.importExport.load();
     */

    it('navigates to CSP Benchmarks page', async () => {
      await cloudPosture.benchmarks.goToBenchmarksPage();
    });

    it('navigates from CSP Benchmarks page to Fleet Add Integration page', async () => {
      await cloudPosture.benchmarks.goToBenchmarksPage();
      await cloudPosture.benchmarks.goToNewIntegration();
    });

    it('navigates from CSP Benchmarks page to Fleet Agent Policy page', async () => {
      await cloudPosture.benchmarks.goToBenchmarksPage();
      await cloudPosture.benchmarks.goToIntegrationAgentPolicy();
    });
  });
}
