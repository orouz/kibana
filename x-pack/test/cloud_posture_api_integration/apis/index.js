/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

// import { setupTestUsers } from './test_users';

export default function ({ loadTestFile, getService }) {
  describe('Cloud Posture API', function () {
    // before(async () => {
    //   await setupTestUsers(getService('security'));
    // });

    // Update Package Policy Rules
    loadTestFile(require.resolve('./update_rules_configuration'));
  });
}
