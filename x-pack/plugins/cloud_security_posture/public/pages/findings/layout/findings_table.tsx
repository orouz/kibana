/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React from 'react';
import {
  EuiEmptyPrompt,
  EuiInMemoryTable,
  EuiSpacer,
  type EuiInMemoryTableProps,
} from '@elastic/eui';
import { FormattedMessage } from '@kbn/i18n-react';
import * as TEST_SUBJECTS from '../test_subjects';

import {
  FindingsDistributionBar,
  Props as DistributionBarProps,
} from './findings_distribution_bar';
import { ErrorCallout } from './error_callout';

type PaginatedTable<T> = Exclude<EuiInMemoryTableProps<T>, { pagination: undefined }>;
interface Props<T> {
  error: Error | null;
  tableProps: PaginatedTable<T>;
  distributionBarProps: DistributionBarProps;
}

export const FindingsTable = <T extends unknown>(props: Props<T>) => {
  if (props.error) return <ErrorCallout error={props.error} />;

  // Show "zero state"
  if (!props.tableProps.loading && !props.tableProps.items.length)
    // TODO: use our own logo
    return (
      <EuiEmptyPrompt
        iconType="logoKibana"
        data-test-subj={TEST_SUBJECTS.LATEST_FINDINGS_TABLE_NO_FINDINGS_EMPTY_STATE}
        title={
          <h2>
            <FormattedMessage
              id="xpack.csp.findings.latestFindings.noFindingsTitle"
              defaultMessage="There are no Findings"
            />
          </h2>
        }
      />
    );

  return (
    <>
      <FindingsDistributionBar {...props.distributionBarProps} />
      <EuiSpacer />
      <EuiInMemoryTable {...props.tableProps} />
    </>
  );
};
