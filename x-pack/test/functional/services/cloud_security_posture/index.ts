/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { FtrProviderContext } from '../../ftr_provider_context';

// import { UptimeSettingsProvider } from './common';

export function CloudPostureCommonProvider({ getService, getPageObjects }: FtrProviderContext) {
  //   const testSubjects = getService('testSubjects');
  //   const browser = getService('browser');
  //   const retry = getService('retry');
  //   const find = getService('find');
  const supertest = getService('supertest');

  return {
    async getLatestPackageVersion() {
      const version = await supertest
        .get(`/api/fleet/epm/packages?experimental=true`)
        .set({ 'kbn-xsrf': 'some-xsrf-token' })
        .expect(200)
        .then((response) => {
          console.log({ response });
          return response.body.find((r: any) => r.name === 'cloud_security_posture')?.version;
        });
      return version;
    },
  };
}

export function CloudPostureProvider(context: FtrProviderContext) {
  const common = CloudPostureCommonProvider(context);

  return {
    common,
  };
}
