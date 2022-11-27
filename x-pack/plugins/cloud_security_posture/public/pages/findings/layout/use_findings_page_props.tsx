/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { Pagination } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { UseQueryResult } from '@tanstack/react-query';
import {
  CriteriaWithPagination,
  EuiInMemoryTableProps,
} from '@elastic/eui/src/components/basic_table';
import type { Evaluation } from '../../../../common/types';
import { FindingsSearchBarProps } from './findings_search_bar';
import { getFindingsPageSizeInfo, getFilters, getPaginationTableParams } from '../utils/utils';
import { OnAddFilter } from './findings_layout';
import { useLimitProperties } from '../utils/get_limit_properties';
import { Props as DistributionBarProps } from './findings_distribution_bar';
import { FindingsBaseURLQuery, FindingsResult } from '../types';

interface FindingsPageArgs<
  T,
  UrlQuery extends FindingsBaseURLQuery,
  Result extends FindingsResult<T>
> {
  urlQuery: UrlQuery;
  result: UseQueryResult<Result>;
  pageSize: number;
  dataView: any;
  setUrlQuery: (query: Partial<UrlQuery>) => void;
  setPageSize: (size: number) => void;
}

interface FindingsPageProps {
  distributionBarProps: ReturnType<typeof useDistributionBarProps>;
  searchBarProps: ReturnType<typeof useSearchBarProps>;
  limitedTableProps: ReturnType<typeof useLimitProperties>;
  tableFiltersProps: { onAddFilter: OnAddFilter };
}

type GetPropsHandler<HandlerResult> = <
  T,
  UrlQuery extends FindingsBaseURLQuery,
  Result extends FindingsResult<T>
>(
  args: FindingsPageArgs<T, UrlQuery, Result>
) => HandlerResult;

const useDistributionBarProps: GetPropsHandler<DistributionBarProps> = ({
  setUrlQuery,
  urlQuery,
  result,
  pageSize,
  dataView,
}) => {
  const handleDistributionClick = (evaluation: Evaluation) => {
    setUrlQuery({
      ...urlQuery,
      pageIndex: 0,
      filters: getFilters({
        filters: urlQuery.filters,
        dataView,
        field: 'result.evaluation',
        value: evaluation,
        negate: false,
      }),
    });
  };

  return {
    distributionOnClick: handleDistributionClick,
    type: i18n.translate('xpack.csp.findings.latestFindings.tableRowTypeLabel', {
      defaultMessage: 'Findings',
    }),
    total: result.data?.total || 0,
    passed: result.data?.count.passed || 0,
    failed: result.data?.count.failed || 0,
    ...getFindingsPageSizeInfo({
      pageIndex: urlQuery.pageIndex,
      pageSize,
      currentPageSize: result.data?.page.length || 0,
    }),
  };
};

const useSearchBarProps: GetPropsHandler<FindingsSearchBarProps> = ({
  urlQuery,
  dataView,
  result,
  setUrlQuery,
}) => ({
  dataView,
  loading: result.isFetching,
  setQuery: (query) =>
    setUrlQuery({
      ...urlQuery,
      ...query,
      pageIndex: 0,
    }),
});

type PaginatedTable<T> = Omit<EuiInMemoryTableProps<T>, 'columns' | 'pagination'> & {
  pagination: Pagination;
};

const useTableProps = <T, UrlQuery extends FindingsBaseURLQuery, Result extends FindingsResult<T>>({
  result,
  urlQuery,
  setUrlQuery,
  pageSize,
  limitedTotalItemCount,
  setPageSize,
}: FindingsPageArgs<T, UrlQuery, Result> & {
  limitedTotalItemCount: number;
}): PaginatedTable<T> => {
  return {
    loading: result.isFetching,
    items: result.data?.page || [],
    pagination: getPaginationTableParams({
      pageSize,
      pageIndex: urlQuery.pageIndex,
      totalItemCount: limitedTotalItemCount,
    }),
    onTableChange: ({ page, sort }: CriteriaWithPagination<Result['page'][number]>) => {
      setPageSize(page.size);
      setUrlQuery({
        ...urlQuery,
        sort,
        pageIndex: page.index,
      });
    },
  };
};

export const useFindingsPageComputedProps = <
  T,
  UrlQuery extends FindingsBaseURLQuery,
  Result extends FindingsResult<T>
>(
  props: FindingsPageArgs<T, UrlQuery, Result>
): {
  tableProps: PaginatedTable<T>;
} & FindingsPageProps => {
  const { isLastLimitedPage, limitedTotalItemCount } = useLimitProperties({
    total: props.result.data?.total,
    pageIndex: props.urlQuery.pageIndex,
    pageSize: props.pageSize,
  });
  const tableProps = useTableProps<T, UrlQuery, Result>({ ...props, limitedTotalItemCount });
  const distributionBarProps = useDistributionBarProps(props);
  const searchBarProps = useSearchBarProps(props);
  const tableFiltersProps: { onAddFilter: OnAddFilter } = {
    onAddFilter: (field, value, negate) =>
      props.setUrlQuery({
        ...props.urlQuery,
        pageIndex: 0,
        filters: getFilters({
          filters: props.urlQuery.filters,
          dataView: props.dataView,
          field,
          value,
          negate,
        }),
      }),
  };

  return {
    distributionBarProps,
    tableProps,
    searchBarProps,
    limitedTableProps: { isLastLimitedPage, limitedTotalItemCount },
    tableFiltersProps,
  };
};
