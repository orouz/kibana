/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React, { useState } from 'react';
import {
  EuiButtonEmpty,
  EuiPageHeader,
  type EuiDescriptionListProps,
  EuiTableActionsColumnType,
  EuiTableFieldDataColumnType,
  useEuiTheme,
} from '@elastic/eui';
import { Link, useParams } from 'react-router-dom';
import { FormattedMessage } from '@kbn/i18n-react';
import { generatePath } from 'react-router-dom';
import { i18n } from '@kbn/i18n';
import { CspInlineDescriptionList } from '../../../../components/csp_inline_description_list';
import { CspFinding } from '../../../../../common/schemas/csp_finding';
import { CloudPosturePageTitle } from '../../../../components/cloud_posture_page_title';
import * as TEST_SUBJECTS from '../../test_subjects';
import {
  baseFindingsColumns,
  createColumnWithFilters,
  getExpandColumn,
  LimitedResultsBar,
  PageTitle,
  PageTitleText,
} from '../../layout/findings_layout';
import { findingsNavigation } from '../../../../common/navigation/constants';
import { usePageSize } from '../../../../common/hooks/use_page_size';
import type { FindingsBaseProps } from '../../types';
import { getSelectedRowStyle } from '../../utils/utils';
import { FindingsSearchBar } from '../../layout/findings_search_bar';
import { LOCAL_STORAGE_PAGE_SIZE_FINDINGS_KEY } from '../../../../common/constants';
import { FindingsTable } from '../../layout/findings_table';
import { useFindingsPageComputedProps } from '../../layout/use_findings_page_props';
import { FindingsRuleFlyout } from '../../findings_flyout/findings_flyout';
import { FindingsPageHeader } from '../../layout/findings_page_header';
import { useFindings } from '../../use_findings';
import { getEsResult, getEsRequest, getDefaultQuery } from './resource_findings_config';

const BackToResourcesButton = () => (
  <Link to={generatePath(findingsNavigation.findings_by_resource.path)}>
    <EuiButtonEmpty iconType={'arrowLeft'}>
      <FormattedMessage
        id="xpack.csp.findings.resourceFindings.backToResourcesPageButtonLabel"
        defaultMessage="Back to resources"
      />
    </EuiButtonEmpty>
  </Link>
);

const getResourceFindingSharedValues = (sharedValues: {
  resourceId: string;
  resourceSubType: string;
  resourceName: string;
  clusterId: string;
}): EuiDescriptionListProps['listItems'] => [
  {
    title: i18n.translate('xpack.csp.findings.resourceFindingsSharedValues.resourceTypeTitle', {
      defaultMessage: 'Resource Type',
    }),
    description: sharedValues.resourceSubType,
  },
  {
    title: i18n.translate('xpack.csp.findings.resourceFindingsSharedValues.resourceIdTitle', {
      defaultMessage: 'Resource ID',
    }),
    description: sharedValues.resourceId,
  },
  {
    title: i18n.translate('xpack.csp.findings.resourceFindingsSharedValues.clusterIdTitle', {
      defaultMessage: 'Cluster ID',
    }),
    description: sharedValues.clusterId,
  },
];

export const ResourceFindings = ({ dataView }: FindingsBaseProps) => {
  const params = useParams<{ resourceId: string }>();
  const { pageSize, setPageSize } = usePageSize(LOCAL_STORAGE_PAGE_SIZE_FINDINGS_KEY);
  const [selectedFinding, setSelectedFinding] = useState<CspFinding>();

  const findings = useFindings({
    dataView,
    urlParams: params,
    getDefaultUrlQuery: getDefaultQuery,
    getEsRequest,
    getEsResult,
  });

  const error = findings.result.error;

  const pageProps = useFindingsPageComputedProps<
    CspFinding,
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

  const { euiTheme } = useEuiTheme();

  const getRowProps = (row: CspFinding) => ({
    style: selectedFinding ? getSelectedRowStyle(euiTheme, row, selectedFinding) : undefined,
  });

  const columns: [
    EuiTableActionsColumnType<CspFinding>,
    ...Array<EuiTableFieldDataColumnType<CspFinding>>
  ] = [
    getExpandColumn<CspFinding>({ onClick: setSelectedFinding }),
    createColumnWithFilters(baseFindingsColumns['result.evaluation'], { onAddFilter }),
    createColumnWithFilters(baseFindingsColumns['rule.name'], { onAddFilter }),
    createColumnWithFilters(baseFindingsColumns['rule.benchmark.name'], { onAddFilter }),
    baseFindingsColumns['rule.section'],
    baseFindingsColumns['@timestamp'],
  ];

  return (
    <div data-test-subj={TEST_SUBJECTS.FINDINGS_CONTAINER}>
      <FindingsSearchBar {...pageProps.searchBarProps} />
      <FindingsPageHeader
        title={
          <ResourceFindingsPageTitle
            resourceId={params.resourceId}
            resourceName={findings.result.data?.resourceName}
            resourceSubType={findings.result.data?.resourceSubType}
            clusterId={findings.result.data?.clusterId}
          />
        }
        groupBy="resource"
        error={error}
      />
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

const ResourceFindingsPageTitle = ({
  resourceId,
  resourceName,
  resourceSubType,
  clusterId,
}: {
  resourceId?: string;
  resourceName?: string;
  resourceSubType?: string;
  clusterId?: string;
}) => (
  <>
    <PageTitle>
      <BackToResourcesButton />
      <PageTitleText
        title={
          <CloudPosturePageTitle
            title={i18n.translate('xpack.csp.findings.resourceFindings.resourceFindingsPageTitle', {
              defaultMessage: '{resourceName} - Findings',
              values: { resourceName },
            })}
          />
        }
      />
    </PageTitle>
    {resourceId && resourceName && resourceSubType && clusterId && (
      <EuiPageHeader
        description={
          <CspInlineDescriptionList
            listItems={getResourceFindingSharedValues({
              resourceId,
              resourceName,
              resourceSubType,
              clusterId,
            })}
          />
        }
      />
    )}
  </>
);
