/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import expect from '@kbn/expect';
import Chance from 'chance';
// import { FtrProviderContext } from '../../ftr_provider_context';

export default function ({ getService }) {
  const supertest = getService('supertest');
  const esArchiver = getService('esArchiver');
  const chance = new Chance();
  const kibanaServer = getService('kibanaServer');
  const cloudPosture = getService('cloudPosture');

  describe('POST /internal/cloud_security_posture/update_rules_config', () => {
    before(async () => {
      await kibanaServer.savedObjects.cleanStandardList();
      await esArchiver.load('x-pack/test/functional/es_archives/fleet/empty_fleet_server');
    });

    after(async () => {
      await kibanaServer.savedObjects.cleanStandardList();
      await esArchiver.unload('x-pack/test/functional/es_archives/fleet/empty_fleet_server');
    });

    it('returns a NotFound (404) response when updating an unknown package policy', async () => {
      const unknownPackagePolicyId = chance.guid();

      const { body: response } = await supertest
        .post(`/internal/cloud_security_posture/update_rules_config`)
        .set('kbn-xsrf', 'xxxx')
        .send({ package_policy_id: unknownPackagePolicyId, rules: [] })
        .expect(404);

      expect(response.error).to.be('Not Found');
    });

    it('updates rules in package policy vars', async () => {
      const packagePolicy = await cloudPosture.createPackagePolicy();
      const { body: currentRules } = await supertest
        .get(`/api/saved_objects/_find?type=csp_rule`)
        .expect(200);

      const ruleToToggle = currentRules.saved_objects[0];

      const { body: updatedPackagePolicy } = await supertest
        .post(`/internal/cloud_security_posture/update_rules_config`)
        .set('kbn-xsrf', 'xxxx')
        .send({
          package_policy_id: packagePolicy.id,
          rules: [{ id: ruleToToggle.id, enabled: !ruleToToggle.attributes.enabled }],
        })
        .expect(200);

      const packageRulesRegoIds: string[] = updatedPackagePolicy.vars.runtimeCfg.value.split('\n');
      const result = packageRulesRegoIds.includes(ruleToToggle.attributes.rego_rule_id);
      expect(result).to.be(!ruleToToggle.attributes.enabled);
    });
  });
}
