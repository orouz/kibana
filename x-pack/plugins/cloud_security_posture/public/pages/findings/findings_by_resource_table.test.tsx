/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import * as TEST_SUBJECTS from './test_subjects';
import { FindingsByResourceTable, formatNumber, getResourceId } from './findings_by_resource_table';
import * as TEXT from './translations';
import type { PropsOf } from '@elastic/eui';
import Chance from 'chance';
import numeral from '@elastic/numeral';
import { TestProvider } from '../../test/test_provider';

const chance = new Chance();

const getFakeFindingsByResource = () => ({
  resource_id: chance.guid(),
  cluster_id: chance.guid(),
  cis_section: chance.word(),
  failed_findings: {
    total: chance.integer(),
    normalized: chance.integer({ min: 0, max: 1 }),
  },
});

type TableProps = PropsOf<typeof FindingsByResourceTable>;

const getPaginationMock = ({
  hasNextPage = false,
  hasPrevPage = false,
}: {
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
} = {}) => ({
  pagination: {
    pageSize: 10,
    options: [5, 10, 25],
    hasNextPage,
    hasPrevPage,
    fetchNext: jest.fn(),
    fetchPrev: jest.fn(),
    setPageSize: jest.fn(),
  },
});

const assertTableDataExists = (data: Array<ReturnType<typeof getFakeFindingsByResource>>) => {
  data.forEach((item, i) => {
    const row = screen.getByTestId(
      TEST_SUBJECTS.getFindingsByResourceTableRowTestId(getResourceId(item))
    );
    expect(row).toBeInTheDocument();

    expect(within(row).getByText(item.resource_id)).toBeInTheDocument();
    expect(within(row).getByText(item.cluster_id)).toBeInTheDocument();
    expect(within(row).getByText(item.cis_section)).toBeInTheDocument();
    expect(within(row).getByText(formatNumber(item.failed_findings.total))).toBeInTheDocument();
    expect(
      within(row).getByText(new RegExp(numeral(item.failed_findings.normalized).format('0%')))
    ).toBeInTheDocument();
  });
};

describe('<FindingsByResourceTable />', () => {
  it('renders the error state', () => {
    const error = new Error('some error');

    const props: TableProps = {
      loading: false,
      data: undefined,
      error,
      ...getPaginationMock(),
    };

    render(
      <TestProvider>
        <FindingsByResourceTable {...props} />
      </TestProvider>
    );

    expect(screen.getByText(error.message)).toBeInTheDocument();
  });

  it('renders the zero state when status success and data has a length of zero ', async () => {
    const props: TableProps = {
      loading: false,
      data: { page: [], after: undefined, total: 0 },
      error: null,
      ...getPaginationMock(),
    };

    render(
      <TestProvider>
        <FindingsByResourceTable {...props} />
      </TestProvider>
    );

    expect(screen.getByText(TEXT.NO_FINDINGS)).toBeInTheDocument();
  });

  it('renders the success state with a table and its provided items', () => {
    const data = Array.from({ length: 10 }, getFakeFindingsByResource);

    const props: TableProps = {
      loading: false,
      data: { page: data, after: undefined, total: data.length },
      error: null,
      ...getPaginationMock(),
    };

    render(
      <TestProvider>
        <FindingsByResourceTable {...props} />
      </TestProvider>
    );

    assertTableDataExists(data);
  });

  it('calls fetchNext when "next" button is clicked', () => {
    const data = Array.from({ length: 10 }, getFakeFindingsByResource);

    const props: TableProps = {
      loading: false,
      data: { page: data, after: undefined, total: data.length },
      error: null,
      ...getPaginationMock({ hasNextPage: true }),
    };

    render(
      <TestProvider>
        <FindingsByResourceTable {...props} />
      </TestProvider>
    );

    const nextButton = screen.getByTestId(TEST_SUBJECTS.FINDINGS_PAGINATION_NEXT_PAGE);
    expect(nextButton).toBeInTheDocument();

    fireEvent.click(nextButton);
    expect(props.pagination.fetchNext).toHaveBeenCalled();
  });

  it('calls fetchPrev when "prev" button is clicked', () => {
    const data = Array.from({ length: 10 }, getFakeFindingsByResource);

    const props: TableProps = {
      loading: false,
      data: { page: data, after: undefined, total: data.length },
      error: null,
      ...getPaginationMock({ hasPrevPage: true }),
    };

    render(
      <TestProvider>
        <FindingsByResourceTable {...props} />
      </TestProvider>
    );

    const prevButton = screen.getByTestId(TEST_SUBJECTS.FINDINGS_PAGINATION_PREV_PAGE);
    expect(prevButton).toBeInTheDocument();

    fireEvent.click(prevButton);
    expect(props.pagination.fetchPrev).toHaveBeenCalled();
  });
});
