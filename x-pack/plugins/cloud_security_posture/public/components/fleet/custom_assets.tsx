/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';

import { type CustomAssetsAccordionProps, CustomAssetsAccordion } from '@kbn/fleet-plugin/public';

export const CspCustomAssetsExtension = () => {
  // const { http } = useKibana<ApmPluginStartDeps>().services;
  // const basePath = http?.basePath.get();
  const views: CustomAssetsAccordionProps['views'] = [
    {
      name: 'Dashboard',
      url: 'foo',
      description: 'View CSP Dashboard',
    },
    {
      name: 'Findings',
      url: 'foo',
      description: 'View Findings of CIS Benchmark rules',
    },
    {
      name: 'Rules',
      url: 'foo',
      description: 'Manage Rules for CIS Benchmark',
    },
  ];

  return <CustomAssetsAccordion views={views} initialIsOpen />;
};
// eslint-disable-next-line import/no-default-export
export { CspCustomAssetsExtension as default };
