/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiSpacer } from '@elastic/eui';
import { SecuritySolutionPageWrapper } from '../../../common/components/page_wrapper';
import { HeaderPage } from '../../../common/components/header_page';
import { useCloudPostureFindingsApi } from '../../common/api';
import { FindingsTable } from './findings_table';
import { SpyRoute } from '../../../common/utils/route/spy_routes';
import { CloudPosturePage } from '../../../app/types';
import { useKibana } from '../../../common/lib/kibana';
import { SiemSearchBar } from '../../../common/components/search_bar';
import { IIndexPattern } from 'src/plugins/data/public';

export const Findings = () => (
  <SecuritySolutionPageWrapper noPadding={false} data-test-subj="csp_rules">
    <HeaderPage hideSourcerer border title={'Findings'} />
    <FindingsTableContainer />
    <SpyRoute pageName={CloudPosturePage.findings} />
  </SecuritySolutionPageWrapper>
);

const idxPtrn: IIndexPattern = {
  fields: [
    {
      name: '_id',
      searchable: true,
      type: 'string',
      aggregatable: false,
      esTypes: [],
    },
    {
      name: '_index',
      searchable: true,
      type: 'string',
      aggregatable: true,
      esTypes: [],
    },
  ],
  title: '.alerts-security.alerts-default',
};
// Note: we can't use useCloudPostureFindingsApi inside Findings, need to nest it
const FindingsTableContainer = () => {
  const findings = useCloudPostureFindingsApi();
  const { services } = useKibana();

  console.log({ services });
  // const { TopNavMenu } = services.navigation.ui;
  const { SearchBar } = services.data.ui;

  // TODO: handle states: isSuccess/isError/isLoading
  if (!findings.isSuccess) return <h1>???</h1>;

  const d = findings.data.map((v) => ({ ...v, ...v._source }));

  return (
    <div style={{ height: '100%', width: '100%' }}>
      {/* <SiemSearchBar id="global" indexPattern={idxPtrn} /> */}
      {/* <SearchBar
        appName="foo"
        indexPatterns={[idxPtrn]}
        // showQueryBar
        showQueryInput
        // showFilterBar
        // showSaveQuery
        onQuerySubmit={(...v) => {
          console.log({ v });
        }}
      /> */}
      <EuiSpacer />
      <FindingsTable data={d} />
    </div>
  );
};
