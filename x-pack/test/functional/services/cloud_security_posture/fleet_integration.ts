/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { FtrProviderContext } from '../../ftr_provider_context';

export function FleetIntegrationProvider({ getService, getPageObjects }: FtrProviderContext) {
  const supertest = getService('supertest');

  return {
    async getAgentPolicy() {
      return supertest
        .get('/api/fleet/agent_policies/policy2')
        .expect(200)
        .then((response) => response.body.item);
    },
    getPackageInfo() {
      return supertest
        .get(`/api/fleet/epm/packages/cloud_security_posture`)
        .set('kbn-xsrf', 'xxxx')
        .expect(200)
        .then((response) => response.body.item);
    },
    async installIntegration(name: string = 'cloud_security_posture-1') {
      const [packageInfo, agentPolicy] = await Promise.all([
        this.getPackageInfo(),
        this.getAgentPolicy(),
      ]);
      const packagePolicy = await supertest
        .post('/api/fleet/package_policies')
        .set('kbn-xsrf', 'xxxx')
        .send({
          name,
          description: '',
          namespace: 'default',
          policy_id: agentPolicy.id,
          enabled: true,
          inputs: [
            {
              type: 'cloudbeat/cis_k8s',
              policy_template: 'kspm',
              enabled: true,
              streams: [
                {
                  enabled: true,
                  data_stream: {
                    type: 'logs',
                    dataset: 'cloud_security_posture.findings',
                  },
                },
              ],
            },
            {
              type: 'cloudbeat/cis_eks',
              policy_template: 'kspm',
              enabled: false,
              streams: [
                {
                  enabled: false,
                  data_stream: {
                    type: 'logs',
                    dataset: 'cloud_security_posture.findings',
                  },
                  vars: {
                    access_key_id: {
                      type: 'text',
                    },
                    secret_access_key: {
                      type: 'text',
                    },
                    session_token: {
                      type: 'text',
                    },
                  },
                },
              ],
            },
          ],
          package: {
            name: packageInfo.name,
            title: packageInfo.title,
            version: packageInfo.version,
          },
          vars: {
            runtimeCfg: {
              type: 'yaml',
            },
          },
        })
        .expect(200)
        .then((response) => response.body.item);

      return packagePolicy;
    },
  };
}
