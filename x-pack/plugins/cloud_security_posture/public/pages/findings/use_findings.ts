/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import type { Filter } from '@kbn/es-query';
import { type UseQueryResult, useQuery } from 'react-query';
import type { AggregationsAggregate, SearchResponse } from '@elastic/elasticsearch/lib/api/types';
import { number } from 'io-ts';
import { extractErrorMessage, isNonNullable } from '../../../common/utils/helpers';
import type {
  DataView,
  EsQuerySortValue,
  IKibanaSearchResponse,
  SerializedSearchSourceFields,
  TimeRange,
} from '../../../../../../src/plugins/data/common';
import type { CspClientPluginStartDeps } from '../../types';

import * as TEXT from './translations';
import type { CoreStart } from '../../../../../../src/core/public';
import type { CspFinding } from './types';
import { useKibana } from '../../common/hooks/use_kibana';

interface CspFindings {
  data: CspFinding[];
  total: number;
}

export interface CspFindingsRequest
  extends Required<Pick<SerializedSearchSourceFields, 'sort' | 'size' | 'from' | 'query'>> {
  filters: Filter[];
  dateRange: TimeRange;
}

type ResponseProps = 'data' | 'error' | 'status';
type Result = UseQueryResult<CspFindings, unknown>;

// TODO: use distributive Pick
export type CspFindingsResponse =
  | Pick<Extract<Result, { status: 'success' }>, ResponseProps>
  | Pick<Extract<Result, { status: 'error' }>, ResponseProps>
  | Pick<Extract<Result, { status: 'idle' }>, ResponseProps>
  | Pick<Extract<Result, { status: 'loading' }>, ResponseProps>;

const FIELDS_WITHOUT_KEYWORD_MAPPING = new Set(['@timestamp']);

// NOTE: .keyword comes from the mapping we defined for the Findings index
const getSortKey = (key: string): string =>
  FIELDS_WITHOUT_KEYWORD_MAPPING.has(key) ? key : `${key}.keyword`;

/**
 * @description utility to transform a column header key to its field mapping for sorting
 * @example Adds '.keyword' to every property we sort on except values of `FIELDS_WITHOUT_KEYWORD_MAPPING`
 * @todo find alternative
 * @note we choose the keyword 'keyword' in the field mapping
 */
const mapEsQuerySortKey = (sort: readonly EsQuerySortValue[]): EsQuerySortValue[] =>
  sort.slice().reduce<EsQuerySortValue[]>((acc, cur) => {
    const entry = Object.entries(cur)[0];
    if (!entry) return acc;

    const [k, v] = entry;
    acc.push({ [getSortKey(k)]: v });

    return acc;
  }, []);

const showResponseErrorToast =
  ({ toasts }: CoreStart['notifications']) =>
  (error: unknown): void => {
    if (error instanceof Error) toasts.addError(error, { title: TEXT.SEARCH_FAILED });
    else toasts.addDanger(extractErrorMessage(error, TEXT.SEARCH_FAILED));
  };

const extractFindings = ({
  rawResponse: { hits },
}: IKibanaSearchResponse<
  SearchResponse<CspFinding, Record<string, AggregationsAggregate>>
>): CspFindings => ({
  // TODO: use 'fields' instead of '_source' ?
  data: hits.hits.map((hit) => hit._source!),
  total: number.is(hits.total) ? hits.total : 0,
});

const createFindingsSearchSource = (
  {
    query,
    dateRange,
    dataView,
    filters,
    ...rest
  }: Omit<CspFindingsRequest, 'queryKey'> & {
    dataView: DataView;
  },
  queryService: CspClientPluginStartDeps['data']['query']
): SerializedSearchSourceFields => {
  if (query) queryService.queryString.setQuery(query);
  const timeFilter = queryService.timefilter.timefilter.createFilter(dataView, dateRange);
  queryService.filterManager.setFilters([...filters, timeFilter].filter(isNonNullable));

  return {
    ...rest,
    sort: mapEsQuerySortKey(rest.sort),
    filter: queryService.filterManager.getFilters(),
    query: queryService.queryString.getQuery(),
    index: dataView.id, // TODO: constant
  };
};

/**
 * @description a react-query#mutation wrapper on the data plugin searchSource
 * @todo use 'searchAfter'. currently limited to 10k docs. see https://github.com/elastic/kibana/issues/116776
 */
export const useFindings = (
  dataView: DataView,
  searchProps: CspFindingsRequest,
  urlKey?: string // Needed when URL query (searchProps) didn't change (now-15) but require a refetch
): CspFindingsResponse => {
  const {
    notifications,
    data: { query, search },
  } = useKibana().services;

  return useQuery(
    ['csp_findings', { searchProps, urlKey }],
    async () => {
      const source = await search.searchSource.create(
        createFindingsSearchSource({ ...searchProps, dataView }, query)
      );

      const response = await source.fetch$().toPromise();
      console.log({ response });

      return response;
    },
    {
      cacheTime: 0,
      onError: showResponseErrorToast(notifications!),
      select: extractFindings,
    }
  );
};

export const useFindingsCounter = ({
  dataView,
  searchProps,
  urlKey,
}: {
  dataView: DataView;
  searchProps: CspFindingsRequest;
  urlKey?: string; // Needed when URL query (searchProps) didn't change (now-15) but require a refetch
}) => {
  const { data } = useKibana().services;

  if (searchProps.query) data.query.queryString.setQuery(searchProps.query);

  return useQuery(['csp_findings', { searchProps, urlKey }], () =>
    data.search
      .search({
        params: {
          index: 'logs-cis_kubernetes_benchmark.findings*',
          size: 0,
          track_total_hits: true,
          // aggregations: {
          //   count: { value_count: { field: 'result.evaluation' } },
          aggs: {
            count: {
              terms: {
                // returns 4606 passed, 1410 failed , total: 6016
                field: 'result.evaluation',
              },
            },
          },
          // aggs: {
          //   count: {
          //     terms: {
          //       // returns 196 passed, 60 failed , total: 5888
          //       field: 'result.evaluation.keyword',
          //     },
          //   },
          // },
        },

        //   aggs: {
        //     my_buckets: {
        //       composite: {
        //         sources: [{ count: { terms: { field: 'result.evaluation.keyword' } } }],
        //       },
        //     },
        //   },
        // },
      })
      .toPromise()
  );
};

// 7654 passed
// 2346 failed
