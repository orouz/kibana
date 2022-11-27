/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React from 'react';
import { generatePath, Link, Route, Switch } from 'react-router-dom';
import { TrackApplicationView } from '@kbn/usage-collection-plugin/public';
import { EuiTableFieldDataColumnType, EuiToolTip, EuiTextColor } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import numeral from '@elastic/numeral';
import { FindingsSearchBar } from '../layout/findings_search_bar';
import * as TEST_SUBJECTS from '../test_subjects';
import { usePageSize } from '../../../common/hooks/use_page_size';
import type { FindingsBaseProps } from '../types';
import {
  baseFindingsColumns,
  createColumnWithFilters,
  LimitedResultsBar,
} from '../layout/findings_layout';
import { findingsNavigation } from '../../../common/navigation/constants';
import { ResourceFindings } from './resource_findings/resource_findings_container';
import { LOCAL_STORAGE_PAGE_SIZE_FINDINGS_KEY } from '../../../common/constants';
import { FindingsTable } from '../layout/findings_table';
import { useFindingsPageComputedProps } from '../layout/use_findings_page_props';
import { FindingsPageHeader, FindingsPageTitle } from '../layout/findings_page_header';
import { useFindings } from '../use_findings';
import {
  getEsRequest,
  getEsResult,
  getDefaultQuery,
  type FindingsByResourcePage,
} from './findings_by_resource_config';

export const formatNumber = (value: number) =>
  value < 1000 ? value : numeral(value).format('0.0a');

export const FindingsByResourceContainer = ({ dataView }: FindingsBaseProps) => (
  <Switch>
    <Route
      exact
      path={findingsNavigation.findings_by_resource.path}
      render={() => (
        <TrackApplicationView viewId={findingsNavigation.findings_by_resource.id}>
          <LatestFindingsByResource dataView={dataView} />
        </TrackApplicationView>
      )}
    />
    <Route
      path={findingsNavigation.resource_findings.path}
      render={() => (
        <TrackApplicationView viewId={findingsNavigation.resource_findings.id}>
          <ResourceFindings dataView={dataView} />
        </TrackApplicationView>
      )}
    />
  </Switch>
);

const baseColumns: Array<EuiTableFieldDataColumnType<FindingsByResourcePage>> = [
  {
    ...baseFindingsColumns['resource.id'],
    field: 'resource_id',
    render: (resourceId: FindingsByResourcePage['resource_id']) => (
      <Link
        to={generatePath(findingsNavigation.resource_findings.path, { resourceId })}
        className="eui-textTruncate"
        title={resourceId}
      >
        {resourceId}
      </Link>
    ),
  },
  baseFindingsColumns['resource.sub_type'],
  baseFindingsColumns['resource.name'],
  baseFindingsColumns['rule.benchmark.name'],
  {
    field: 'rule.section',
    truncateText: true,
    name: (
      <FormattedMessage
        id="xpack.csp.findings.findingsByResourceTable.cisSectionsColumnLabel"
        defaultMessage="CIS Sections"
      />
    ),
    render: (sections: string[]) => {
      const items = sections.join(', ');
      return (
        <EuiToolTip content={items} anchorClassName="eui-textTruncate">
          <>{items}</>
        </EuiToolTip>
      );
    },
  },
  baseFindingsColumns.cluster_id,
  {
    field: 'failed_findings',
    width: '150px',
    truncateText: true,
    sortable: true,
    name: (
      <FormattedMessage
        id="xpack.csp.findings.findingsByResourceTable.failedFindingsColumnLabel"
        defaultMessage="Failed Findings"
      />
    ),
    render: (failedFindings: FindingsByResourcePage['failed_findings']) => (
      <EuiToolTip
        content={i18n.translate(
          'xpack.csp.findings.findingsByResourceTable.failedFindingsToolTip',
          {
            defaultMessage: '{failed} out of {total}',
            values: {
              failed: failedFindings.count,
              total: failedFindings.total_findings,
            },
          }
        )}
      >
        <>
          <EuiTextColor color={failedFindings.count === 0 ? '' : 'danger'}>
            {formatNumber(failedFindings.count)}
          </EuiTextColor>
          <span> ({numeral(failedFindings.normalized).format('0%')})</span>
        </>
      </EuiToolTip>
    ),
    dataType: 'number',
  },
];

type BaseFindingColumnName = typeof baseColumns[number]['field'];

const findingsByResourceColumns = Object.fromEntries(
  baseColumns.map((column) => [column.field, column])
) as Record<BaseFindingColumnName, typeof baseColumns[number]>;

const LatestFindingsByResource = ({ dataView }: FindingsBaseProps) => {
  const { pageSize, setPageSize } = usePageSize(LOCAL_STORAGE_PAGE_SIZE_FINDINGS_KEY);

  const findings = useFindings({
    dataView,
    getDefaultUrlQuery: getDefaultQuery,
    getEsRequest,
    getEsResult,
  });

  const error = findings.result.error;

  const pageProps = useFindingsPageComputedProps<
    FindingsByResourcePage,
    ReturnType<typeof getDefaultQuery>,
    ReturnType<typeof getEsResult>
  >({
    setUrlQuery: findings.setUrlQuery,
    setPageSize,
    result: findings.result,
    urlQuery: findings.urlQuery,
    pageSize,
    dataView,
  });

  const onAddFilter = pageProps.tableFiltersProps.onAddFilter;

  const columns = [
    findingsByResourceColumns.resource_id,
    createColumnWithFilters(findingsByResourceColumns['resource.sub_type'], { onAddFilter }),
    createColumnWithFilters(findingsByResourceColumns['resource.name'], { onAddFilter }),
    createColumnWithFilters(findingsByResourceColumns['rule.benchmark.name'], { onAddFilter }),
    findingsByResourceColumns['rule.section'],
    createColumnWithFilters(findingsByResourceColumns.cluster_id, { onAddFilter }),
    findingsByResourceColumns.failed_findings,
  ];

  return (
    <div data-test-subj={TEST_SUBJECTS.FINDINGS_CONTAINER}>
      <FindingsSearchBar {...pageProps.searchBarProps} />
      <FindingsPageHeader title={<FindingsPageTitle />} groupBy="resource" error={error} />
      <FindingsTable
        error={error}
        distributionBarProps={pageProps.distributionBarProps}
        tableProps={{
          ...pageProps.tableProps,
          columns,
          sorting: {
            sort: { field: 'failed_findings', direction: findings.urlQuery.sort.direction },
          },
        }}
      />
      {pageProps.limitedTableProps.isLastLimitedPage && <LimitedResultsBar />}
    </div>
  );
};
