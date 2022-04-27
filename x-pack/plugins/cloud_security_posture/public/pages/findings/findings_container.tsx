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
import type { FindingsBaseURLQuery, FindingsGroupByKind } from './types';
import { FindingsByResourceQuery, useFindingsByResource } from './use_findings_by_resource';
import { FindingsGroupBySelector } from './findings_group_by_selector';
import { INTERNAL_FEATURE_FLAGS } from '../../../common/constants';
import { useFindingsCounter } from './use_findings_count';
import { FindingsDistributionBar } from './findings_distribution_bar';
import { FindingsByResourceTable } from './findings_by_resource_table';

type PageQuery = FindingsBaseURLQuery & (FindingsGroupByNoneQuery | FindingsByResourceQuery);

/**
 * Merges the default group query with the next partial group query
 */
export const getDefaultQuery = (query?: Partial<PageQuery>): PageQuery => {
  switch (query?.groupBy) {
    case 'resource':
      return {
        ...getFindingsByResourceQuery(),
        ...query,
      };
    case 'none':
    default:
      return {
        ...getFindingsGroupByNoneQuery(),
        ...query,
      };
  }
};

const getFindingsGroupByNoneQuery = (): FindingsBaseURLQuery & FindingsGroupByNoneQuery => ({
  query: { language: 'kuery', query: '' },
  filters: [],
  sort: [{ ['@timestamp']: SortDirection.desc }],
  from: 0,
  size: 10,
  groupBy: 'none',
});

const getFindingsByResourceQuery = (): FindingsBaseURLQuery & FindingsByResourceQuery => ({
  query: { language: 'kuery', query: '' },
  filters: [],
  sort: [{ ['resource_id']: SortDirection.desc }],
  size: 10,
  groupBy: 'resource',
});

const getGroupByOptions = (): Array<EuiComboBoxOptionOption<FindingsGroupByKind>> => [
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

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const FindingsContainer = ({ dataView }: { dataView: DataView }) => {
  const { euiTheme } = useEuiTheme();
  const groupByOptions = useMemo(getGroupByOptions, []);
  const { urlQuery, setUrlQuery } = useUrlQuery<
    FindingsBaseURLQuery & (FindingsGroupByNoneQuery | FindingsByResourceQuery)
  >(getDefaultQuery);

  /**
   * Sets the URL query with values persisted from previous query, if relevant.
   *
   * when groupBy is specified, the URL query is reset to its matching default query
   * when it's not, the current query is persisted to the URL query
   */
  const setQuery: typeof setUrlQuery = (nextQuery) =>
    setUrlQuery({
      ...getDefaultQuery(nextQuery.groupBy ? nextQuery : urlQuery),
      ...nextQuery,
    });

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
    after: (urlQuery as FindingsByResourceQuery).after,
    sort: urlQuery.sort,
  });

  const findingsCount = useFindingsCounter({
    ...baseEsQuery,
    enabled: urlQuery.groupBy === 'none',
  });

  const findingsGroupByNone = useFindings({
    ...baseEsQuery,
    enabled: urlQuery.groupBy === 'none',
    size: urlQuery.size,
    from: (urlQuery as FindingsGroupByNoneQuery).from,
    sort: urlQuery.sort,
  });

  return (
    <div data-test-subj={TEST_SUBJECTS.FINDINGS_CONTAINER}>
      <FindingsSearchBar
        dataView={dataView}
        setQuery={setQuery}
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
            onChange={(type) => setQuery({ groupBy: type[0]?.value })}
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
              setQuery={setQuery}
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
            setSort={(sort) =>
              sort && setQuery({ sort: [{ [sort.field]: sort.direction as SortDirection }] })
            }
            pagination={{
              hasNextPage: findingsGroupByResource.hasNextPage,
              hasPrevPage: findingsGroupByResource.hasPrevPage,
              options: PAGE_SIZE_OPTIONS,
              pageSize: urlQuery.size,
              setPageSize: (size) => setQuery({ size }),
              fetchNext: () => setQuery({ after: findingsGroupByResource.getNextKey() }),
              fetchPrev: () => setQuery({ after: findingsGroupByResource.getPreviousKey() }),
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
