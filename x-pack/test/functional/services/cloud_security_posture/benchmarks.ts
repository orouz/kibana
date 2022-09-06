/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { FtrProviderContext } from '../../ftr_provider_context';

export function BenchmarksProvider({ getService, getPageObjects }: FtrProviderContext) {
  const testSubjects = getService('testSubjects');
  const retry = getService('retry');
  const supertest = getService('supertest');
  const PageObjects = getPageObjects(['common']);

  return {
    goToBenchmarksPage: async () => {
      await PageObjects.common.navigateToUrl(
        'securitySolution',
        'cloud_security_posture/benchmarks',
        { shouldUseHashForSubUrl: false }
      );
      await retry.try(async () => {
        await testSubjects.existOrFail('benchmarks-page-header', {
          timeout: 10000,
        });
      });
    },
    async goToNewIntegration() {
      await testSubjects.click('csp_add_integration');
      // TODO: this is in Fleet, if 'addIntegrationPolicyButton' changes it'll break
      await retry.try(async () => {
        await testSubjects.existOrFail('csp_add_integration', {
          timeout: 10000,
        });
      });
    },
    async goToIntegrationRules() {
      await testSubjects.click('benchmarks-table-column-integration');
      await retry.try(async () => {
        await testSubjects.existOrFail('csp_rules_container', {
          timeout: 10000,
        });
      });
    },
    async goToIntegrationAgentPolicy() {
      await testSubjects.click('benchmarks-table-column-agent-policy');
      // TODO: verify we got there
    },
  };
}
