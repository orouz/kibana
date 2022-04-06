/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React from 'react';
import { css } from '@emotion/react';
import { EuiTextColor, EuiSpacer, EuiFlexGroup, EuiFlexItem, useEuiTheme } from '@elastic/eui';
import { FormattedMessage } from '@kbn/i18n-react';
import { i18n } from '@kbn/i18n';
import numeral from '@elastic/numeral';

interface Props {
  total: number;
  passed: number;
  failed: number;
  pageStart: number;
  pageEnd: number;
}

const formatNumber = (value: number) => (value < 1000 ? value : numeral(value).format('0.0a'));

export const FindingsDistributionBar = (props: Props) => (
  <div>
    <Counters {...props} />
    <EuiSpacer size="s" />
    <DistributionBar {...props} />
  </div>
);

const Counters = ({ pageStart, pageEnd, total, failed, passed }: Props) => (
  <EuiFlexGroup justifyContent="spaceBetween">
    <EuiFlexItem>
      <CurrentPageOfTotal pageStart={pageStart} pageEnd={pageEnd} total={total} />
    </EuiFlexItem>
    <EuiFlexItem
      css={css`
        align-items: flex-end;
      `}
    >
      <PassedFailedCounters passed={passed} failed={failed} />
    </EuiFlexItem>
  </EuiFlexGroup>
);

const PassedFailedCounters = ({ passed, failed }: Pick<Props, 'passed' | 'failed'>) => {
  const { euiTheme } = useEuiTheme();
  return (
    <div
      css={css`
        display: flex;
      `}
    >
      <Counter
        label={i18n.translate('xpack.csp.findings.distributionBar.totalPassedLabel', {
          defaultMessage: 'Passed',
        })}
        color={euiTheme.colors.success}
        value={passed}
      />
      <Counter
        label={i18n.translate('xpack.csp.findings.distributionBar.totalFailedLabel', {
          defaultMessage: 'Failed',
        })}
        color={euiTheme.colors.danger}
        value={failed}
      />
    </div>
  );
};

const CurrentPageOfTotal = ({
  pageEnd,
  pageStart,
  total,
}: Pick<Props, 'pageEnd' | 'pageStart' | 'total'>) => (
  <EuiTextColor color="subdued">
    {total > 0 && (
      <FormattedMessage
        id="xpack.csp.findings.distributionBar.showingPageOfTotalLabel"
        defaultMessage="Showing {pageStart}-{pageEnd} of {total} Findings"
        values={{
          pageStart: <b>{pageStart}</b>,
          pageEnd: <b>{pageEnd}</b>,
          total: <b>{formatNumber(total)}</b>,
        }}
      />
    )}
  </EuiTextColor>
);

const DistributionBar: React.FC<Props> = ({ passed, failed }) => {
  const { euiTheme } = useEuiTheme();
  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        width: 100%;
        height: 8px;
        background: ${euiTheme.colors.subdued};
      `}
    >
      <div
        css={css`
          flex: ${passed};
          background: ${euiTheme.colors.success};
          height: 100%;
        `}
      />
      <div
        css={css`
          flex: ${failed};
          background: ${euiTheme.colors.danger};
          height: 100%;
        `}
      />
    </div>
  );
};

const Counter = ({ label, value, color }: { label: string; value: number; color: string }) => {
  const { euiTheme } = useEuiTheme();
  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        &:not(:last-child) {
          margin-right: ${euiTheme.size.l};
        }
        span:not(:last-of-type) {
          margin-right: ${euiTheme.size.s};
        }
      `}
    >
      <span
        css={css`
          background: ${color};
          width: 8px;
          height: 8px;
          border-radius: 50%;
        `}
      />
      <span>{label}</span>
      <span
        css={css`
          background: ${euiTheme.colors.lightestShade};
          padding: ${euiTheme.size.xs};
          border-radius: ${euiTheme.border.radius.small};
          font-weight: bold;
        `}
      >
        {formatNumber(value)}
      </span>
    </div>
  );
};
