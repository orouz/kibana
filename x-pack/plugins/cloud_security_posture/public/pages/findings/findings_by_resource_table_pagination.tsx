/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState } from 'react';
import {
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiContextMenuItem,
  EuiContextMenuPanel,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPopover,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import * as TEST_SUBJECTS from './test_subjects';

interface Props {
  pageSize: number;
  options: number[];
  hasNextPage: boolean;
  hasPrevPage: boolean;
  fetchNext(): void;
  fetchPrev(): void;
  setPageSize(size: number): void;
}

export const FindingsByResourceTablePagination = ({
  options,
  pageSize,
  hasPrevPage,
  hasNextPage,
  setPageSize,
  fetchNext,
  fetchPrev,
}: Props) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const onButtonClick = () => setIsPopoverOpen((isOpen) => !isOpen);
  const closePopover = () => setIsPopoverOpen(false);

  const button = (
    <EuiButtonEmpty
      size="xs"
      color="text"
      iconType="arrowDown"
      iconSide="right"
      onClick={onButtonClick}
    >
      <FormattedMessage
        id="xpack.csp.findingsByResourceTable.rowsPerPageButtonLabel"
        defaultMessage="Rows per page"
      />
    </EuiButtonEmpty>
  );

  return (
    <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" responsive={false} wrap>
      <EuiFlexItem grow={false}>
        <EuiPopover
          button={button}
          isOpen={isPopoverOpen}
          closePopover={closePopover}
          panelPaddingSize="none"
        >
          <EuiContextMenuPanel
            items={options.map((size) => (
              <EuiContextMenuItem
                key={size}
                color={size === pageSize ? 'primary' : undefined}
                onClick={() => {
                  closePopover();
                  setPageSize(size);
                }}
              >
                {size}
              </EuiContextMenuItem>
            ))}
          />
        </EuiPopover>
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <div>
          <ArrowButton type="prev" disabled={!hasPrevPage} onClick={fetchPrev} />
          <ArrowButton type="next" disabled={!hasNextPage} onClick={fetchNext} />
        </div>
      </EuiFlexItem>
    </EuiFlexGroup>
  );
};

const ArrowButton = ({
  type,
  disabled,
  onClick,
}: {
  type: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
}) => (
  <EuiButtonIcon
    aria-label={
      type === 'prev'
        ? i18n.translate('xpack.csp.findingsByResourceTable.pagination.prevButtonLabel', {
            defaultMessage: 'Previous Page',
          })
        : i18n.translate('xpack.csp.findingsByResourceTable.pagination.nextButtonLabel', {
            defaultMessage: 'Next page',
          })
    }
    data-test-subj={
      type === 'next'
        ? TEST_SUBJECTS.FINDINGS_PAGINATION_NEXT_PAGE
        : TEST_SUBJECTS.FINDINGS_PAGINATION_PREV_PAGE
    }
    color="text"
    className={'euiPaginationArrowButton'}
    iconType={type === 'prev' ? 'arrowLeft' : 'arrowRight'}
    disabled={disabled}
    onClick={onClick}
  />
);
