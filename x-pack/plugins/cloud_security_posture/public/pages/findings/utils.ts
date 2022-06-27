/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { buildEsQuery } from '@kbn/es-query';
import { EuiBasicTableProps, Pagination } from '@elastic/eui';
import { useCallback, useEffect, useMemo } from 'react';
import { i18n } from '@kbn/i18n';
import { estypes } from '@elastic/elasticsearch';
import type { FindingsBaseProps, FindingsBaseURLQuery } from './types';
import { useKibana } from '../../common/hooks/use_kibana';

export const findingsDataFields = new Set([
  '@timestamp',

  'resource.id',
  'resource.sub_type',
  'resource.name',

  'result.evaluation.keyword',

  'rule.name',
  'rule.section.keyword',

  'cluster_id.keyword',

  // flyout
  'remediation',
  'impact',
  'default_value',
  'rationale',

  'result.expected',
  'result.evidence',

  'host.architecture.keyword',
  'host.hostname.keyword',
  'host.ip.keyword',
  'host.mac.keyword',
  'host.name.keyword',
  'host.os.codename.keyword',
  'host.os.family.keyword',
  'host.os.kernel.keyword',
  'host.os.name.keyword',
  'host.os.type.keyword',
] as const);

export type CspFindingsDataFields = Record<
  typeof findingsDataFields extends Set<infer U> ? U : never,
  string
>;

export const getDocValuesFields = (fields: Set<string>) => ({
  docvalue_fields: Array.from(fields),
  // '_source' is Disabled by default in order to only get fields we need.
  // enable to get the full document.
  _source: false,
});

export const getDocValuesFieldsData = <T>(
  hit: estypes.SearchResponse<T>['hits']['hits'][number]
) => {
  if (!hit.fields) throw new Error('expected fields to exists');

  return Object.fromEntries(
    Object.entries(hit.fields).map(([fieldKey, fieldValues]) => [fieldKey, fieldValues[0]])
  );
};

const getBaseQuery = ({ dataView, query, filters }: FindingsBaseURLQuery & FindingsBaseProps) => {
  try {
    return {
      query: buildEsQuery(dataView, query, filters), // will throw for malformed query
    };
  } catch (error) {
    return {
      query: undefined,
      error: error instanceof Error ? error : new Error('Unknown Error'),
    };
  }
};

type TablePagination = NonNullable<EuiBasicTableProps<unknown>['pagination']>;

export const getPaginationTableParams = (
  params: TablePagination & Pick<Required<TablePagination>, 'pageIndex' | 'pageSize'>,
  pageSizeOptions = [10, 25, 100],
  showPerPageOptions = true
): Required<TablePagination> => ({
  ...params,
  pageSizeOptions,
  showPerPageOptions,
});

export const usePersistedQuery = <T>(getter: ({ filters, query }: FindingsBaseURLQuery) => T) => {
  const {
    data: {
      query: { filterManager, queryString },
    },
  } = useKibana().services;

  return useCallback(
    () =>
      getter({
        filters: filterManager.getAppFilters(),
        query: queryString.getQuery(),
      }),
    [getter, filterManager, queryString]
  );
};

export const getPaginationQuery = ({
  pageIndex,
  pageSize,
}: Pick<Pagination, 'pageIndex' | 'pageSize'>) => ({
  from: pageIndex * pageSize,
  size: pageSize,
});

export const useBaseEsQuery = ({
  dataView,
  filters,
  query,
}: FindingsBaseURLQuery & FindingsBaseProps) => {
  const {
    notifications: { toasts },
    data: {
      query: { filterManager, queryString },
    },
  } = useKibana().services;

  const baseEsQuery = useMemo(
    () => getBaseQuery({ dataView, filters, query }),
    [dataView, filters, query]
  );

  /**
   * Sync filters with the URL query
   */
  useEffect(() => {
    filterManager.setAppFilters(filters);
    queryString.setQuery(query);
  }, [filters, filterManager, queryString, query]);

  const handleMalformedQueryError = () => {
    const error = baseEsQuery.error;
    if (error) {
      toasts.addError(error, {
        title: i18n.translate('xpack.csp.findings.search.queryErrorToastMessage', {
          defaultMessage: 'Query Error',
        }),
        toastLifeTimeMs: 1000 * 5,
      });
    }
  };

  useEffect(handleMalformedQueryError, [baseEsQuery.error, toasts]);

  return baseEsQuery;
};
