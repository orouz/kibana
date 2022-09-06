/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { FtrConfigProviderContext } from '@kbn/test';

const CSP_PACKAGE_ID = 'cloud_security_posture';

export default async function ({ readConfigFile }: FtrConfigProviderContext) {
  const xPackAPITestsConfig = await readConfigFile(require.resolve('../api_integration/config.ts'));

  return {
    testFiles: [require.resolve('./apis')],
    servers: xPackAPITestsConfig.get('servers'),
    esTestCluster: xPackAPITestsConfig.get('esTestCluster'),
    kbnTestServer: xPackAPITestsConfig.get('kbnTestServer'),
    junit: {
      reportName: 'X-Pack Cloud Posture API Integration Tests',
    },
    services: {
      ...xPackAPITestsConfig.get('services'),
      cloudPosture: (ctx) => {
        const kibanaServer = ctx.getService('kibanaServer');
        const supertest = ctx.getService('supertest');

        return {
          createAgentPolicy() {
            return supertest
              .post('/api/fleet/agent_policies?sys_monitoring=true')
              .set('kbn-xsrf', 'xxxx')
              .send({
                name: 'Agent policy 1',
                description: '',
                namespace: 'default',
                monitoring_enabled: ['logs', 'metrics'],
              })
              .expect(200)
              .then((response) => response.body.item);
          },
          getPackageInfo() {
            return supertest
              .get(`/api/fleet/epm/packages/${CSP_PACKAGE_ID}`)
              .set('kbn-xsrf', 'xxxx')
              .expect(200)
              .then((response) => response.body.item);
          },
          async createPackagePolicy() {
            const [packageInfo, agentPolicy] = await Promise.all([
              this.getPackageInfo(),
              this.createAgentPolicy(),
            ]);
            const packagePolicy = await supertest
              .post('/api/fleet/package_policies')
              .set('kbn-xsrf', 'xxxx')
              .send({
                name: 'supper',
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
      },
    },
  };
}
