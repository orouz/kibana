/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { memo } from 'react';
import styled, { css } from 'styled-components';
import { EuiLink, EuiEmptyPrompt } from '@elastic/eui';
import { useKibana } from '@kbn/kibana-react-plugin/public';
import { i18n } from '@kbn/i18n';
import { ManagementEmptyStateWrapper } from '../../management_empty_state_wrapper';

const EmptyPrompt = styled(EuiEmptyPrompt)`
  ${() => css`
    max-width: 100%;
  `}
`;

export const ActionsLogEmptyState = memo(() => {
  const { docLinks } = useKibana().services;

  return (
    <ManagementEmptyStateWrapper>
      <EmptyPrompt
        iconType="editorUnorderedList"
        title={
          <h2>
            {i18n.translate('xpack.securitySolution.actions_log.empty.title', {
              defaultMessage: 'Actions history is empty',
            })}
          </h2>
        }
        body={
          <div>
            {i18n.translate('xpack.securitySolution.actions_log.empty.content', {
              defaultMessage: 'No response actions performed',
            })}
          </div>
        }
        actions={[
          <EuiLink external href={docLinks?.links.securitySolution.responseActions} target="_blank">
            {i18n.translate('xpack.securitySolution.actions_log.empty.link', {
              defaultMessage: 'Read more about response actions',
            })}
          </EuiLink>,
        ]}
      />
    </ManagementEmptyStateWrapper>
  );
});

ActionsLogEmptyState.displayName = 'ActionsLogEmptyState';
