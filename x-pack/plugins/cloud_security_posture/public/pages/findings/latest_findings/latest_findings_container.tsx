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
import type { FindingsBaseProps } from '../types';
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
  usePersistedQuery,
} from '../utils';
import { PageWrapper, PageTitle, PageTitleText } from '../layout/findings_layout';
import { FindingsGroupBySelector } from '../layout/findings_group_by_selector';
import { useUrlQuery } from '../../../common/hooks/use_url_query';
import { ErrorCallout } from '../layout/error_callout';
import { useAppContext } from '../../../application/app_state_context';
import { createStateContainer, useContainerState } from '@kbn/kibana-utils-plugin/common';

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

export const LatestFindingsContainer = ({ dataView }: FindingsBaseProps) => {
  // const getPersistedDefaultQuery = usePersistedQuery(getDefaultQuery);
  // const { urlQuery, setUrlQuery } = useUrlQuery(getPersistedDefaultQuery);

  const appContext = useAppContext();
  const pageFoo = { pageIndex: 0, pageSize: 10 };

  /**
   * Page URL query to ES query
   */
  const baseEsQuery = useBaseEsQuery({
    dataView,
    filters: appContext.state.filters,
    query: appContext.state.query,
  });

  /**
   * Page ES query result
   */
  const findingsGroupByNone = useLatestFindings({
    ...getPaginationQuery(pageFoo),
    query: baseEsQuery.query,
    sort: { field: '@timestamp', direction: 'desc' },
    enabled: !baseEsQuery.error,
  });

  const error = findingsGroupByNone.error || baseEsQuery.error;

  return (
    <div data-test-subj={TEST_SUBJECTS.FINDINGS_CONTAINER}>
      <FindingsSearchBar
        dataView={dataView}
        setQuery={(query) => {
          // setUrlQuery({ ...query, pageIndex: 0 });
          // setUrlQuery({ ...query, pageIndex: 0 });
          appContext.setState(query);
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
                    pageIndex: pageFoo.pageIndex,
                    pageSize: pageFoo.pageSize,
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
                pageSize: pageFoo.pageSize,
                pageIndex: pageFoo.pageIndex,
                totalItemCount: findingsGroupByNone.data?.total || 0,
              })}
              sorting={{
                sort: { field: '@timestamp', direction: 'desc' },
              }}
              setTableOptions={console.log}
              // onAddFilter={console.log}
              // setTableOptions={({ page, sort }) =>
              //   setUrlQuery({
              //     sort,
              //     pageIndex: page.index,
              //     pageSize: page.size,
              //   })
              // }
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
