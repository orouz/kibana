/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import type { FtrProviderContext } from '../ftr_provider_context';

// Defined in EUI
const getEuiPaginationText = (size: 10 | 25) => `Rows per page: ${size}`;
const getEuiPaginationRowTestId = (size: 10 | 25) => `tablePagination-${size}-rows`;
const getEuiPaginationButtonTestId = (index: number) => `pagination-button-${index}`;
const EUI_PAGINATION_BUTTON = 'tablePaginationPopoverButton';

// Defined in CSP plugin
const FINDINGS_ROUTE = 'cloud_security_posture/findings';
const FINDINGS_TABLE_TESTID = 'findings_table';
const getFilterValueSelector = (columnIndex: number) =>
  `tbody tr td:nth-child(${columnIndex + 1}) div[data-test-subj="filter_cell_value"]`;

const getFilterCellSelector = (rowIndex: number, columnIndex: number) =>
  `tbody tr:nth-child(${rowIndex + 1}) td:nth-child(${columnIndex + 1})`;

const getFilterAddSelector = (rowIndex: number, columnIndex: number) =>
  `${getFilterCellSelector(
    rowIndex,
    columnIndex
  )} button[data-test-subj="findings_table_cell_add_filter"]`;

const getFilterAddNegatedSelector = (rowIndex: number, columnIndex: number) =>
  `${getFilterCellSelector(
    rowIndex,
    columnIndex
  )} button[data-test-subj="findings_table_cell_add_negated_filter"]`;

// Defined in Security Solution plugin
const SECURITY_SOLUTION_APP_NAME = 'securitySolution';

export function FindingsPageProvider({ getService, getPageObjects }: FtrProviderContext) {
  const testSubjects = getService('testSubjects');
  const PageObjects = getPageObjects(['common']);

  const table = {
    getTableElement: () => testSubjects.find(FINDINGS_TABLE_TESTID),

    addFilter: async (columnName: number, cellValue: string, negated = false) => {
      const tableElement = await table.getTableElement();
      const [columnIndex] = await table.getColumnIndex(columnName);
      const values = await table.getFilterColumnValues(columnName);
      const rowIndex = values.findIndex((value) => value === cellValue);
      const filterElement = await tableElement.findByCssSelector(
        negated
          ? getFilterAddNegatedSelector(rowIndex, columnIndex)
          : getFilterAddSelector(rowIndex, columnIndex)
      );

      await filterElement.click();
    },
    columnCellExistsOrFail: async (columnName: string, cellValue: string) => {
      const values = await table.getFilterColumnValues(columnName);
      expect(values.some((i) => i === cellValue)).to.be(true);
    },
    columnCellMissingOrFail: async (columnName: string, cellValue: string) => {
      const values = await table.getFilterColumnValues(columnName);
      expect(values.every((i) => i !== cellValue)).to.be(true);
    },
    getColumnIndex: async (columnName: string) => {
      const tableElement = await table.getTableElement();
      const headers = await tableElement.findAllByCssSelector('thead tr :is(th,td)');
      const headerIndexes = await Promise.all(headers.map((header) => header.getVisibleText()));
      const columnIndex = headerIndexes.findIndex((i) => i === columnName);
      expect(columnIndex).to.be.greaterThan(-1);
      return [columnIndex, headers[columnIndex]] as [
        number,
        Awaited<ReturnType<typeof testSubjects.find>>
      ];
    },

    getFilterColumnValues: async (columnName: string) => {
      const tableElement = await table.getTableElement();
      const [columnIndex] = await table.getColumnIndex(columnName);
      const columnCells = await tableElement.findAllByCssSelector(
        getFilterValueSelector(columnIndex)
      );

      return await Promise.all(columnCells.map((h) => h.getVisibleText()));
    },

    assertColumnSorting: async (columnName: string, direction: 'asc' | 'desc') => {
      const values = (await table.getFilterColumnValues(columnName)).filter(Boolean);
      expect(values).to.not.be.empty();
      const sorted = values
        .slice()
        .sort((a, b) => (direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a)));
      values.every((value, i) => expect(value).to.be(sorted[i]));
    },

    /**
     * Toggles the sorting of a column of Findings (EUI Table)
     */
    toggleColumnSorting: async (columnName: string, direction: 'asc' | 'desc') => {
      const getColumnElement = async () => (await table.getColumnIndex(columnName))[1];
      const element = await getColumnElement();
      const currentSort = await element.getAttribute('aria-sort');
      if (currentSort === 'none') {
        // a click is needed to focus on Eui column header
        await element.click();

        // default is ascending
        if (direction === 'desc') {
          const nonStaleElement = await getColumnElement();
          await nonStaleElement.click();
        }
      }
      if (
        (currentSort === 'ascending' && direction === 'desc') ||
        (currentSort === 'descending' && direction === 'asc')
      ) {
        // Without getting the element again, the click throws an error (stale element reference)
        const nonStaleElement = await getColumnElement();
        await nonStaleElement.click();
      }
    },
  };

  const navigateToFindingsPage = async () => {
    await PageObjects.common.navigateToUrl(SECURITY_SOLUTION_APP_NAME, FINDINGS_ROUTE, {
      shouldUseHashForSubUrl: false,
    });
  };

  return {
    navigateToFindingsPage,
    table,
  };
}
