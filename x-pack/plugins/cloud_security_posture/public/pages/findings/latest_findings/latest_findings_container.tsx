/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React from 'react';
import { FormattedMessage } from '@kbn/i18n-react';
import { EuiSpacer } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import type { CspFinding, FindingsBaseProps } from '../types';
import { FindingsTable } from './latest_findings_table';
import { FindingsSearchBar } from '../layout/findings_search_bar';
import * as TEST_SUBJECTS from '../test_subjects';
import { useLatestFindings } from './use_latest_findings';
import type { FindingsGroupByNoneQuery } from './use_latest_findings';
import type { FindingsBaseURLQuery } from '../types';
import { FindingsDistributionBar } from '../layout/findings_distribution_bar';
import {
  getFindingsPageSizeInfo,
  addFilter,
  getPaginationQuery,
  getPaginationTableParams,
  useBaseEsQuery,
} from '../utils';
import { PageWrapper, PageTitle, PageTitleText } from '../layout/findings_layout';
import { FindingsGroupBySelector } from '../layout/findings_group_by_selector';
import { ErrorCallout } from '../layout/error_callout';
import { useAppContextWithPageDefaults } from '../../../application/app_state_context';

export const getDefaultQuery = ({
  query,
  filters,
}: FindingsBaseURLQuery): FindingsBaseURLQuery & FindingsGroupByNoneQuery => ({
  query,
  filters,
  sort: { field: '@timestamp', direction: 'desc' },
  pageIndex: 0,
  pageSize: 10,
});

const fooDef = {
  sort: { field: '@timestamp' as keyof CspFinding, direction: 'desc' as 'desc' | 'asc' },
};

export const LatestFindingsContainer = ({ dataView }: FindingsBaseProps) => {
  // const getPersistedDefaultQuery = usePersistedQuery(getDefaultQuery);
  // const { urlQuery, setUrlQuery } = useUrlQuery(getPersistedDefaultQuery);

  const appContext = useAppContextWithPageDefaults(fooDef);

  /**
   * Page URL query to ES query
   */
  const baseEsQuery = useBaseEsQuery({
    dataView,
    filters: appContext.state.filters,
    query: appContext.state.query,
  });

  console.log(appContext.state);

  /**
   * Page ES query result
   */
  const findingsGroupByNone = useLatestFindings({
    ...getPaginationQuery(appContext.state),
    query: baseEsQuery.query,
    sort: appContext.state.sort,
    enabled: !baseEsQuery.error,
  });
  const error = findingsGroupByNone.error || baseEsQuery.error;

  return (
    <div data-test-subj={TEST_SUBJECTS.FINDINGS_CONTAINER}>
      <FindingsSearchBar
        dataView={dataView}
        setQuery={(query) => {
          appContext.setState({ ...query, pageIndex: 0 });
        }}
        loading={findingsGroupByNone.isFetching}
      />
      <PageWrapper>
        <LatestFindingsPageTitle />
        {error && <ErrorCallout error={error} />}
        {!error && (
          <>
            <FindingsGroupBySelector type="default" />
            {findingsGroupByNone.isSuccess && !!findingsGroupByNone.data.page.length && (
              <FindingsDistributionBar
                {...{
                  type: i18n.translate('xpack.csp.findings.latestFindings.tableRowTypeLabel', {
                    defaultMessage: 'Findings',
                  }),
                  total: findingsGroupByNone.data.total,
                  passed: findingsGroupByNone.data.count.passed,
                  failed: findingsGroupByNone.data.count.failed,
                  ...getFindingsPageSizeInfo({
                    pageIndex: appContext.state.pageIndex,
                    pageSize: appContext.state.pageSize,
                    currentPageSize: findingsGroupByNone.data.page.length,
                  }),
                }}
              />
            )}
            <EuiSpacer />
            <FindingsTable
              loading={findingsGroupByNone.isFetching}
              items={findingsGroupByNone.data?.page || []}
              pagination={getPaginationTableParams({
                pageSize: appContext.state.pageSize,
                pageIndex: appContext.state.pageIndex,
                totalItemCount: findingsGroupByNone.data?.total || 0,
              })}
              sorting={{
                sort: appContext.state.sort,
              }}
              setTableOptions={({ page, sort }) =>
                appContext.setState({
                  sort,
                  pageIndex: page.index,
                  pageSize: page.size,
                })
              }
              onAddFilter={(field, value, negate) =>
                appContext.setState({
                  query: appContext.state.query,
                  filters: addFilter({
                    filters: appContext.state.filters,
                    dataView,
                    field,
                    value,
                    negate,
                  }),
                })
              }
            />
          </>
        )}
      </PageWrapper>
    </div>
  );
};

const LatestFindingsPageTitle = () => (
  <PageTitle>
    <PageTitleText
      title={
        <FormattedMessage
          id="xpack.csp.findings.latestFindings.latestFindingsPageTitle"
          defaultMessage="Findings"
        />
      }
    />
  </PageTitle>
);
