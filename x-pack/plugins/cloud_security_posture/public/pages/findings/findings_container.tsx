/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React, { useMemo } from 'react';
import { EuiComboBoxOptionOption, EuiSpacer, EuiTitle, useEuiTheme } from '@elastic/eui';
import { css } from '@emotion/react';
import { FormattedMessage } from '@kbn/i18n-react';
import { i18n } from '@kbn/i18n';
import type { DataView } from '@kbn/data-plugin/common';
import { SortDirection } from '@kbn/data-plugin/common';
import { buildEsQuery } from '@kbn/es-query';
import { FindingsTable } from './findings_table';
import { FindingsSearchBar } from './findings_search_bar';
import * as TEST_SUBJECTS from './test_subjects';
import { useUrlQuery } from '../../common/hooks/use_url_query';
import { useFindings } from './use_findings';
import type { FindingsGroupByNoneQuery } from './use_findings';
import type { FindingsBaseURLQuery } from './types';
import { FindingsByResourceQuery, useFindingsByResource } from './use_findings_by_resource';
import { FindingsGroupBySelector } from './findings_group_by_selector';
import { INTERNAL_FEATURE_FLAGS } from '../../../common/constants';
import { useFindingsCounter } from './use_findings_count';
import { FindingsDistributionBar } from './findings_distribution_bar';
import { FindingsByResourceTable } from './findings_by_resource_table';

// TODO: separate queries
export const getDefaultQuery = (): FindingsBaseURLQuery &
  FindingsGroupByNoneQuery &
  FindingsByResourceQuery => ({
  query: { language: 'kuery', query: '' },
  filters: [],
  sort: [{ ['@timestamp']: SortDirection.desc }],
  from: 0,
  size: 10,
  groupBy: 'none',
  after: undefined,
});

const getGroupByOptions = (): Array<EuiComboBoxOptionOption<FindingsBaseURLQuery['groupBy']>> => [
  {
    value: 'none',
    label: i18n.translate('xpack.csp.findings.groupBySelector.groupByNoneLabel', {
      defaultMessage: 'None',
    }),
  },
  {
    value: 'resource',
    label: i18n.translate('xpack.csp.findings.groupBySelector.groupByResourceIdLabel', {
      defaultMessage: 'Resource',
    }),
  },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const FindingsContainer = ({ dataView }: { dataView: DataView }) => {
  const { euiTheme } = useEuiTheme();
  const groupByOptions = useMemo(getGroupByOptions, []);
  const { urlQuery, setUrlQuery } = useUrlQuery(getDefaultQuery);

  const baseEsQuery = useMemo(
    () => ({
      index: dataView.title,
      // TODO: this will throw for malformed query
      // page will display an error boundary with the JS error
      // will be accounted for before releasing the feature
      query: buildEsQuery(dataView, urlQuery.query, urlQuery.filters),
    }),
    [dataView, urlQuery]
  );

  const findingsGroupByResource = useFindingsByResource({
    ...baseEsQuery,
    enabled: urlQuery.groupBy === 'resource',
    size: urlQuery.size,
    after: urlQuery.after,
  });

  const findingsCount = useFindingsCounter({
    ...baseEsQuery,
    enabled: urlQuery.groupBy === 'none',
  });

  const findingsGroupByNone = useFindings({
    ...baseEsQuery,
    enabled: urlQuery.groupBy === 'none',
    size: urlQuery.size,
    from: urlQuery.from,
    sort: urlQuery.sort,
  });

  return (
    <div data-test-subj={TEST_SUBJECTS.FINDINGS_CONTAINER}>
      <FindingsSearchBar
        dataView={dataView}
        setQuery={setUrlQuery}
        query={urlQuery.query}
        filters={urlQuery.filters}
        loading={findingsGroupByNone.isLoading}
      />
      <div
        css={css`
          padding: ${euiTheme.size.l};
        `}
      >
        <PageTitle />
        <EuiSpacer />
        {INTERNAL_FEATURE_FLAGS.showFindingsGroupBy && (
          <FindingsGroupBySelector
            type={urlQuery.groupBy}
            onChange={(type) => setUrlQuery({ groupBy: type[0]?.value })}
            options={groupByOptions}
          />
        )}
        <EuiSpacer />
        {urlQuery.groupBy === 'none' && (
          <>
            <FindingsDistributionBar
              total={findingsGroupByNone.data?.total || 0}
              passed={findingsCount.data?.passed || 0}
              failed={findingsCount.data?.failed || 0}
              pageStart={urlQuery.from + 1} // API index is 0, but UI is 1
              pageEnd={urlQuery.from + urlQuery.size}
            />
            <EuiSpacer />
            <FindingsTable
              {...urlQuery}
              setQuery={setUrlQuery}
              data={findingsGroupByNone.data}
              error={findingsGroupByNone.error}
              loading={findingsGroupByNone.isLoading}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          </>
        )}
        {urlQuery.groupBy === 'resource' && (
          <FindingsByResourceTable
            {...urlQuery}
            data={findingsGroupByResource.data}
            error={findingsGroupByResource.error}
            loading={findingsGroupByResource.isLoading}
            pagination={{
              hasNextPage: findingsGroupByResource.hasNextPage,
              hasPrevPage: findingsGroupByResource.hasPrevPage,
              options: PAGE_SIZE_OPTIONS,
              pageSize: urlQuery.size,
              setPageSize: (size) => setUrlQuery({ size }),
              fetchNext: () => setUrlQuery({ after: findingsGroupByResource.getNextKey() }),
              fetchPrev: () => setUrlQuery({ after: findingsGroupByResource.getPreviousKey() }),
            }}
          />
        )}
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
