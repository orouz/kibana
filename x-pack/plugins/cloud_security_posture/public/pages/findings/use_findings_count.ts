/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { useQuery } from 'react-query';
import type * as estypes from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import type {
  DataView,
  IKibanaSearchRequest,
  IKibanaSearchResponse,
} from '../../../../../../src/plugins/data/common';
import { useKibana } from '../../common/hooks/use_kibana';
import { getFindingsBaseQuery, showErrorToast, type CspFindingsRequest } from './use_findings';

type FindingsAggRequest = IKibanaSearchRequest<estypes.SearchRequest>;
type FindingsAggResponse = IKibanaSearchResponse<estypes.SearchResponse<{}, FindingsAggs>>;
interface FindingsAggs extends estypes.AggregationsMultiBucketAggregateBase {
  count: {
    buckets: Array<{
      key: string;
      doc_count: number;
    }>;
  };
}

export const useFindingsCounter = ({
  dataView,
  query,
  filters,
}: {
  dataView: DataView;
} & Pick<CspFindingsRequest, 'query' | 'filters'>) => {
  const {
    data,
    notifications: { toasts },
  } = useKibana().services;

  const baseQuery = getFindingsBaseQuery({ dataView, filters, query }, data.query);

  return useQuery(
    ['csp_findings_counts', { filters, query }],
    () =>
      data.search
        .search<FindingsAggRequest, FindingsAggResponse>({
          params: {
            index: baseQuery.index,
            size: 0,
            track_total_hits: true,
            body: {
              query: baseQuery.body?.query,
              aggs: {
                count: {
                  terms: {
                    field: 'result.evaluation',
                  },
                },
              },
            },
          },
        })
        .toPromise(),
    {
      onError: (error) => showErrorToast(toasts, error),
      select: (response) =>
        Object.fromEntries(
          response.rawResponse.aggregations!.count.buckets.map((bucket) => [
            bucket.key,
            bucket.doc_count,
          ])!
        ) as Record<'passed' | 'failed', number>,
    }
  );
};
