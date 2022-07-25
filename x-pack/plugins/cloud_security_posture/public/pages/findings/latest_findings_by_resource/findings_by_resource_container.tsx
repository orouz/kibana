/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React from 'react';
import { Route, Switch } from 'react-router-dom';
import { FormattedMessage } from '@kbn/i18n-react';
import { EuiSpacer } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { useAppContextWithPageDefaults } from '../../../application/app_state_context';
import { FindingsSearchBar } from '../layout/findings_search_bar';
import * as TEST_SUBJECTS from '../test_subjects';
import type { FindingsBaseProps } from '../types';
import { useFindingsByResource } from './use_findings_by_resource';
import { FindingsByResourceTable } from './findings_by_resource_table';
import {
  getFindingsPageSizeInfo,
  addFilter,
  getPaginationQuery,
  getPaginationTableParams,
  useBaseEsQuery,
} from '../utils';
import { PageTitle, PageTitleText, PageWrapper } from '../layout/findings_layout';
import { FindingsGroupBySelector } from '../layout/findings_group_by_selector';
import { findingsNavigation } from '../../../common/navigation/constants';
import { ResourceFindings } from './resource_findings/resource_findings_container';
import { ErrorCallout } from '../layout/error_callout';
import { FindingsDistributionBar } from '../layout/findings_distribution_bar';

export const FindingsByResourceContainer = ({ dataView }: FindingsBaseProps) => (
  <Switch>
    <Route
      exact
      path={findingsNavigation.findings_by_resource.path}
      render={() => <LatestFindingsByResource dataView={dataView} />}
    />
    <Route
      path={findingsNavigation.resource_findings.path}
      render={() => <ResourceFindings dataView={dataView} />}
    />
  </Switch>
);

const pageDef = {
  zoo: 2,
  sort: { field: 'failed_findings', direction: 'desc' as const },
};

const LatestFindingsByResource = ({ dataView }: FindingsBaseProps) => {
  const appContext = useAppContextWithPageDefaults(pageDef);

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
  const findingsGroupByResource = useFindingsByResource({
    ...getPaginationQuery(appContext.state),
    sortDirection: appContext.state.sort?.direction,
    query: baseEsQuery.query,
    enabled: !baseEsQuery.error,
  });

  const error = findingsGroupByResource.error || baseEsQuery.error;

  return (
    <div data-test-subj={TEST_SUBJECTS.FINDINGS_CONTAINER}>
      <FindingsSearchBar
        dataView={dataView}
        setQuery={(query) => {
          appContext.setState({ ...query, pageIndex: 0 });
        }}
        loading={findingsGroupByResource.isFetching}
      />
      <PageWrapper>
        <PageTitle>
          <PageTitleText
            title={
              <FormattedMessage
                id="xpack.csp.findings.findingsByResource.findingsByResourcePageTitle"
                defaultMessage="Findings"
              />
            }
          />
        </PageTitle>
        {error && <ErrorCallout error={error} />}
        {!error && (
          <>
            <FindingsGroupBySelector type="resource" />
            {findingsGroupByResource.isSuccess && !!findingsGroupByResource.data.page.length && (
              <FindingsDistributionBar
                {...{
                  type: i18n.translate('xpack.csp.findings.findingsByResource.tableRowTypeLabel', {
                    defaultMessage: 'Resources',
                  }),
                  total: findingsGroupByResource.data.total,
                  passed: findingsGroupByResource.data.count.passed,
                  failed: findingsGroupByResource.data.count.failed,
                  ...getFindingsPageSizeInfo({
                    pageIndex: appContext.state.pageIndex,
                    pageSize: appContext.state.pageSize,
                    currentPageSize: findingsGroupByResource.data.page.length,
                  }),
                }}
              />
            )}
            <EuiSpacer />
            <FindingsByResourceTable
              loading={findingsGroupByResource.isFetching}
              items={findingsGroupByResource.data?.page || []}
              pagination={getPaginationTableParams({
                pageSize: appContext.state.pageSize,
                pageIndex: appContext.state.pageIndex,
                totalItemCount: findingsGroupByResource.data?.total || 0,
              })}
              setTableOptions={({ sort, page }) =>
                appContext.setState({
                  sort: { field: sort?.field, direction: sort?.direction as 'desc' },
                  pageIndex: page.index,
                  pageSize: page.size,
                })
              }
              sorting={{
                sort: { field: 'failed_findings', direction: appContext.state.sort.direction },
              }}
              onAddFilter={(field, value, negate) =>
                appContext.setState({
                  pageIndex: 0,
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
