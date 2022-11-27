/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React from 'react';
import { EuiFlexGroup, EuiFlexItem, EuiSpacer } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { CloudPosturePageTitle } from '../../../components/cloud_posture_page_title';
import type { FindingsGroupByKind } from '../types';
import { FindingsGroupBySelector } from './findings_group_by_selector';
import { PageTitle, PageTitleText } from './findings_layout';

interface FindingsPageTitle {
  title: JSX.Element;
  groupBy: FindingsGroupByKind;
  error: Error | null;
}

export const FindingsPageHeader = ({ groupBy, title, error }: FindingsPageTitle) => {
  return (
    <>
      <EuiFlexGroup>
        <EuiFlexItem>{title}</EuiFlexItem>
        <EuiFlexItem grow={false} style={{ width: 400 }}>
          {!!groupBy && !error && <FindingsGroupBySelector type={groupBy} />}
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer />
    </>
  );
};

export const FindingsPageTitle = () => (
  <PageTitle>
    <PageTitleText
      title={
        <CloudPosturePageTitle
          title={i18n.translate('xpack.csp.findings.latestFindings.latestFindingsPageTitle', {
            defaultMessage: 'Findings',
          })}
        />
      }
    />
  </PageTitle>
);
