/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React from 'react';
import { css } from '@emotion/react';
import { EuiSpacer } from '@elastic/eui';

interface Props {
  total: number;
  passed: number;
  failed: number;
  page: number;
}

// TODO: import, locale wont change. CompactFormattedNumber doesnt work?
const formatter = Intl.NumberFormat('en', { notation: 'compact' });

export const FindingsDistributionBar = (props: Props) => (
  <div>
    <Counters {...props} />
    <EuiSpacer size="s" />
    <DistributionBar {...props} />
  </div>
);

const Counters = ({ page, total, failed, passed }: Props) => (
  <CountersContainer
    css={css`
      display: flex;
      justify-content: space-between;
      align-items: center;
    `}
  >
    <CurrentPageOfTotal page={page} total={total} />
    <PassedFailedCounters passed={passed} failed={failed} />
  </CountersContainer>
);

const PassedFailedCounters = ({ passed, failed }: Pick<Props, 'passed' | 'failed'>) => (
  <div
    css={css`
      display: flex;
    `}
  >
    <Counter label="Passed" color="#00bfb3" number={passed} />
    <Counter label="Failed" color="#bd271e" number={failed} />
  </div>
);

// TODO: i18n
const CurrentPageOfTotal = ({ page, total }: Pick<Props, 'page' | 'total'>) => (
  <div>
    Showing {page} of {formatter.format(total)}
  </div>
);

const CountersContainer: React.FC = ({ children }) => (
  <div
    css={css`
      display: flex;
      justify-content: space-between;
      align-items: center;
    `}
  >
    {children}
  </div>
);

const DistributionBar: React.FC<Props> = ({ passed, failed }) => (
  <div
    css={css`
      display: flex;
      align-items: center;
      width: 100%;
      height: 8px;
      background: #eee;
    `}
  >
    <div
      css={css`
        flex: ${passed};
        // TODO: color
        background: #00bfb3;
        height: 100%;
      `}
    />
    <div
      css={css`
        flex: ${failed};
        // TODO: color
        background: #bd271e;
        height: 100%;
      `}
    />
  </div>
);

const Counter = ({ label, number, color }: { label: string; number: number; color: string }) => (
  <div
    css={css`
      display: flex;
      align-items: center;
      margin-right: 10px;
      span:not(last-of-type) {
        margin-right: 5px;
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
        // TODO: colors
        background: #eee;
        padding: 2px 4px;
      `}
    >
      {formatter.format(number)}
    </span>
  </div>
);
