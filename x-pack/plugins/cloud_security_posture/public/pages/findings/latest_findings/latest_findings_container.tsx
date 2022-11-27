/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React, { useState } from 'react';
import { EuiTableActionsColumnType, EuiTableFieldDataColumnType, useEuiTheme } from '@elastic/eui';
import { CspFinding } from '../../../../common/schemas/csp_finding';
import type { FindingsBaseProps } from '../types';
import { FindingsSearchBar } from '../layout/findings_search_bar';
import * as TEST_SUBJECTS from '../test_subjects';
import { getSelectedRowStyle } from '../utils/utils';
import {
  baseFindingsColumns,
  createColumnWithFilters,
  getExpandColumn,
  LimitedResultsBar,
} from '../layout/findings_layout';
import { usePageSize } from '../../../common/hooks/use_page_size';
import { LOCAL_STORAGE_PAGE_SIZE_FINDINGS_KEY } from '../../../common/constants';
import { FindingsTable } from '../layout/findings_table';
import { useFindingsPageComputedProps } from '../layout/use_findings_page_props';
import { FindingsRuleFlyout } from '../findings_flyout/findings_flyout';
import { FindingsPageHeader, FindingsPageTitle } from '../layout/findings_page_header';
import { useFindings } from '../use_findings';
import { getDefaultUrlQuery, getEsRequest, getEsResult } from './latest_findings_config';

export const LatestFindingsContainer = ({ dataView }: FindingsBaseProps) => {
  const { pageSize, setPageSize } = usePageSize(LOCAL_STORAGE_PAGE_SIZE_FINDINGS_KEY);
  const [selectedFinding, setSelectedFinding] = useState<CspFinding>();
  const { euiTheme } = useEuiTheme();
  const findings = useFindings({
    dataView,
    getDefaultUrlQuery,
    getEsRequest,
    getEsResult,
  });

  const error = findings.result.error;

  const pageProps = useFindingsPageComputedProps<
    CspFinding,
    ReturnType<typeof getDefaultUrlQuery>,
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
  const getRowProps = (row: CspFinding) => ({
    style: selectedFinding ? getSelectedRowStyle(euiTheme, row, selectedFinding) : undefined,
  });

  const columns: [
    EuiTableActionsColumnType<CspFinding>,
    ...Array<EuiTableFieldDataColumnType<CspFinding>>
  ] = [
    getExpandColumn<CspFinding>({ onClick: setSelectedFinding }),
    createColumnWithFilters(baseFindingsColumns['resource.id'], { onAddFilter }),
    createColumnWithFilters(baseFindingsColumns['result.evaluation'], { onAddFilter }),
    createColumnWithFilters(baseFindingsColumns['resource.sub_type'], { onAddFilter }),
    createColumnWithFilters(baseFindingsColumns['resource.name'], { onAddFilter }),
    createColumnWithFilters(baseFindingsColumns['rule.name'], { onAddFilter }),
    createColumnWithFilters(baseFindingsColumns['rule.benchmark.name'], { onAddFilter }),
    baseFindingsColumns['rule.section'],
    createColumnWithFilters(baseFindingsColumns.cluster_id, { onAddFilter }),
    baseFindingsColumns['@timestamp'],
  ];

  return (
    <div data-test-subj={TEST_SUBJECTS.FINDINGS_CONTAINER}>
      <FindingsSearchBar {...pageProps.searchBarProps} />
      <FindingsPageHeader title={<FindingsPageTitle />} groupBy="default" error={error} />
      <FindingsTable
        error={error}
        distributionBarProps={pageProps.distributionBarProps}
        tableProps={{
          ...pageProps.tableProps,
          rowProps: getRowProps,
          columns,
          sorting: {
            sort: {
              field: findings.urlQuery.sort.field,
              direction: findings.urlQuery.sort.direction,
            },
          },
        }}
      />
      {selectedFinding && (
        <FindingsRuleFlyout
          findings={selectedFinding}
          onClose={() => setSelectedFinding(undefined)}
        />
      )}
      {pageProps.limitedTableProps.isLastLimitedPage && <LimitedResultsBar />}
    </div>
  );
};
