/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React from 'react';
import { EuiSpacer, EuiButtonEmpty } from '@elastic/eui';
import type { DataView } from '@kbn/data-plugin/common';
import { Link, useParams } from 'react-router-dom';
import { FormattedMessage } from '@kbn/i18n-react';
import { useEuiTheme } from '@elastic/eui';
import { generatePath } from 'react-router-dom';
import * as TEST_SUBJECTS from '../../test_subjects';
import { PageWrapper, PageTitle, PageTitleText } from '../../layout/findings_layout';
import { useCspBreadcrumbs } from '../../../../common/navigation/use_csp_breadcrumbs';
import { findingsNavigation } from '../../../../common/navigation/constants';
import { ResourceFindingsQuery, useResourceFindings } from './use_resource_findings';
import { useUrlQuery } from '../../../../common/hooks/use_url_query';
import type { FindingsBaseURLQuery } from '../../types';
import { getBaseQuery, getEsPaginationFromEui, getEuiPaginationFromEs } from '../../utils';
import { ResourceFindingsTable } from './resource_findings_table';
import { FindingsSearchBar } from '../../layout/findings_search_bar';

const getDefaultQuery = (): FindingsBaseURLQuery & ResourceFindingsQuery => ({
  query: { language: 'kuery', query: '' },
  filters: [],
  from: 0,
  size: 10,
});

const BackToResourcesButton = () => (
  <Link to={generatePath(findingsNavigation.findings_by_resource.path)}>
    <EuiButtonEmpty iconType={'arrowLeft'}>
      <FormattedMessage
        id="xpack.csp.findings.resourceFindings.backToResourcesPageButtonLabel"
        defaultMessage="Back to group by resource view"
      />
    </EuiButtonEmpty>
  </Link>
);

export const ResourceFindings = ({ dataView }: { dataView: DataView }) => {
  useCspBreadcrumbs([findingsNavigation.findings_default]);
  const { euiTheme } = useEuiTheme();
  const params = useParams<{ resourceId: string }>();
  const { urlQuery, setUrlQuery } = useUrlQuery(getDefaultQuery);

  const resourceFindings = useResourceFindings({
    ...getBaseQuery({
      dataView,
      filters: urlQuery.filters,
      query: urlQuery.query,
    }),
    resourceId: params.resourceId,
    size: urlQuery.size,
    from: urlQuery.from,
  });

  return (
    <div data-test-subj={TEST_SUBJECTS.FINDINGS_CONTAINER}>
      <FindingsSearchBar
        dataView={dataView}
        setQuery={setUrlQuery}
        query={urlQuery.query}
        filters={urlQuery.filters}
        loading={resourceFindings.isFetching}
      />
      <PageWrapper>
        <PageTitle>
          <BackToResourcesButton />
          <PageTitleText
            title={
              <div style={{ padding: euiTheme.size.s }}>
                <FormattedMessage
                  id="xpack.csp.findings.resourceFindingsTitle"
                  defaultMessage="{resourceId} - Findings"
                  values={{ resourceId: params.resourceId }}
                />
              </div>
            }
          />
        </PageTitle>
        <EuiSpacer />
        <ResourceFindingsTable
          loading={resourceFindings.isFetching}
          data={resourceFindings.data}
          error={resourceFindings.error}
          pagination={getEuiPaginationFromEs({
            size: urlQuery.size,
            from: urlQuery.from,
            total: resourceFindings.data?.total,
          })}
          setTableOptions={({ page }) =>
            setUrlQuery({
              ...(page && getEsPaginationFromEui(page)),
            })
          }
        />
      </PageWrapper>
    </div>
  );
};
