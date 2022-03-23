/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React from 'react';
import { EuiSpacer } from '@elastic/eui';
import { css } from '@emotion/react';
import { FindingsTable } from './findings_table';
import { FindingsSearchBar } from './findings_search_bar';
import * as TEST_SUBJECTS from './test_subjects';
import type { DataView } from '../../../../../../src/plugins/data/common';
import { SortDirection } from '../../../../../../src/plugins/data/common';
import { useUrlQuery } from '../../common/hooks/use_url_query';
import { useFindings, type CspFindingsRequest, useFindingsCounter } from './use_findings';

// TODO: define this as a schema with default values
// need to get Query and DateRange schema
const getDefaultQuery = (): CspFindingsRequest => ({
  query: { language: 'kuery', query: '' },
  filters: [],
  dateRange: {
    from: 'now-15m',
    to: 'now',
  },
  sort: [{ ['@timestamp']: SortDirection.desc }],
  from: 0,
  size: 10,
});

export const FindingsContainer = ({ dataView }: { dataView: DataView }) => {
  const { urlQuery: findingsQuery, setUrlQuery, key } = useUrlQuery(getDefaultQuery);
  const countResult = useFindingsCounter({
    dataView,
    searchProps: findingsQuery,
    urlKey: key,
  });
  const findingsResult = useFindings(dataView, findingsQuery, key);

  const counters = {
    total: 200,
    page: 10,
    passed: 20,
    failed: 180,
  };

  return (
    <div data-test-subj={TEST_SUBJECTS.FINDINGS_CONTAINER}>
      <FindingsSearchBar
        dataView={dataView}
        setQuery={setUrlQuery}
        {...findingsQuery}
        {...findingsResult}
      />
      <EuiSpacer />
      <FindingsDistributionBar {...counters} />
      <EuiSpacer size="s" />
      <FindingsTable setQuery={setUrlQuery} {...findingsQuery} {...findingsResult} />
    </div>
  );
};

const FindingsDistributionBar = ({
  total,
  passed,
  failed,
  page,
}: {
  total: number;
  passed: number;
  failed: number;
  page: number;
}) => {
  return (
    <div>
      <div
        css={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
        `}
      >
        <div>
          Showing {page} of {total}
        </div>
        <div>
          passed {passed} failed {failed}
        </div>
      </div>
      <EuiSpacer size="s" />
      <div
        css={css`
          display: flex;
          align-items: center;
          width: 100%;
          height: 8px;
        `}
      >
        <div
          css={css`
            flex: 242;
            background: #00bfb3;
            height: 100%;
          `}
        />
        <div
          css={css`
            flex: 400;
            background: #bd271e;
            height: 100%;
          `}
        />
      </div>
    </div>
  );
};
