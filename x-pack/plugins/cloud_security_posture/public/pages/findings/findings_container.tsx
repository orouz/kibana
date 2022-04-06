/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React from 'react';
import { EuiSpacer, EuiTitle, useEuiTheme } from '@elastic/eui';
import { css } from '@emotion/react';
import { FormattedMessage } from '@kbn/i18n-react';
import { FindingsTable } from './findings_table';
import { FindingsSearchBar } from './findings_search_bar';
import * as TEST_SUBJECTS from './test_subjects';
import type { DataView } from '../../../../../../src/plugins/data/common';
import { SortDirection } from '../../../../../../src/plugins/data/common';
import { useUrlQuery } from '../../common/hooks/use_url_query';
import { useFindings, type CspFindingsRequest } from './use_findings';
import { useFindingsCounter } from './use_findings_count';
import { FindingsDistributionBar } from './findings_distribution_bar';

// TODO: define this as a schema with default values
const getDefaultQuery = (): CspFindingsRequest => ({
  query: { language: 'kuery', query: '' },
  filters: [],
  sort: [{ ['@timestamp']: SortDirection.desc }],
  from: 0,
  size: 10,
});

export const FindingsContainer = ({ dataView }: { dataView: DataView }) => {
  const { euiTheme } = useEuiTheme();
  const { urlQuery: findingsQuery, setUrlQuery } = useUrlQuery(getDefaultQuery);

  const findingsResult = useFindings({
    dataView,
    ...findingsQuery,
  });

  const countResult = useFindingsCounter({
    dataView,
    filters: findingsQuery.filters,
    query: findingsQuery.query,
  });

  return (
    <div data-test-subj={TEST_SUBJECTS.FINDINGS_CONTAINER}>
      <FindingsSearchBar
        dataView={dataView}
        setQuery={setUrlQuery}
        query={findingsQuery.query}
        filters={findingsQuery.filters}
        status={findingsResult.status}
      />
      <div
        css={css`
          padding: ${euiTheme.size.l};
        `}
      >
        <PageTitle />
        <EuiSpacer />
        <FindingsDistributionBar
          total={findingsResult.data?.total || 0}
          passed={countResult.data?.passed || 0}
          failed={countResult.data?.failed || 0}
          pageStart={findingsQuery.from + 1} // API index is 0, but UI is 1
          pageEnd={findingsQuery.from + findingsQuery.size}
        />
        <EuiSpacer />
        <FindingsTable setQuery={setUrlQuery} {...findingsQuery} {...findingsResult} />
      </div>
    </div>
  );
};

const PageTitle = () => (
  <EuiTitle size="l">
    <h2>
      <FormattedMessage id="xpack.csp.findings.findingsTitle" defaultMessage="Findings" />
    </h2>
  </EuiTitle>
);
