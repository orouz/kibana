/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState } from 'react';
import { EuiSpacer } from '@elastic/eui';
import { Filter } from '@kbn/es-query';
import { DataView } from 'src/plugins/data/public/types'; // TODO: why is this import a problem and relative isn't?
import { SearchHit } from '@elastic/elasticsearch/lib/api/types';
import { SecuritySolutionPageWrapper } from '../../../common/components/page_wrapper';
import { HeaderPage } from '../../../common/components/header_page';
import { useCloudPostureFindingsApi } from '../../common/api';
import { FindingsTable } from './findings_table';
import { SpyRoute } from '../../../common/utils/route/spy_routes';
import { CloudPosturePage } from '../../../app/types';
import { useKibana } from '../../../common/lib/kibana';

/* eslint-disable @typescript-eslint/no-non-null-assertion */

export const Findings = () => (
  <SecuritySolutionPageWrapper noPadding={false} data-test-subj="csp_rules">
    <HeaderPage hideSourcerer border title={'Findings'} />
    <FindingsTableContainer />
    <SpyRoute pageName={CloudPosturePage.findings} />
  </SecuritySolutionPageWrapper>
);

// Note: we can't use useCloudPostureFindingsApi inside Findings, need to nest it
const FindingsTableContainer = () => {
  // const findings = useCloudPostureFindingsApi();
  const { services } = useKibana();
  const { SearchBar } = services.data.ui;
  const [findingsDataView, setFindingsDataView] = useState<DataView>();
  const [filters, setFilters] = useState<Filter[]>([]);
  const [query, setQuery] = useState<any>();
  const [results, setResults] = useState<Array<SearchHit<any>>>();

  const search = async () => {
    const dataView = (await services.data.dataViews.find('findings'))?.[0];

    setFindingsDataView(dataView);

    // services.data.query.queryString.setQuery(query);
    services.data.query.filterManager.setFilters(filters);

    // const nextQuery = services.data.query.queryString.getQuery();
    const nextFilters = services.data.query.filterManager.getFilters();
    const searchSource = await services.data.search.searchSource.create();
    const searchResponse = await searchSource
      .setParent(undefined)
      .setField('index', dataView!)
      .setField('filter', nextFilters)
      // .setField('query', nextQuery)
      .fetch();

    setResults(searchResponse.hits.hits.map((v) => ({ ...v, ...v._source })));

    console.log({ searchResponse });
  };

  React.useEffect(() => {
    search();
    console.log('new search', { filters, query });
  }, [filters, query]);

  if (!findingsDataView || !results) return null;
  return (
    <div style={{ height: '100%', width: '100%' }}>
      <SearchBar
        appName="foo"
        indexPatterns={[findingsDataView] as any[]}
        showQueryInput
        // TODO: is this prop meant to be provided? not typed directly
        onFiltersUpdated={setFilters}
        onQuerySubmit={setQuery}
      />
      <EuiSpacer />
      <FindingsTable data={results} />
    </div>
  );
};
