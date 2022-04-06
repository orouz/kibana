/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { useQuery } from 'react-query';
import type * as estypes from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import type {
  IKibanaSearchRequest,
  IKibanaSearchResponse,
} from '../../../../../../src/plugins/data/common';
import { useKibana } from '../../common/hooks/use_kibana';
import { showErrorToast } from './use_findings';
import type { FindingsBaseQuery } from './findings_container';

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

export const useFindingsCounter = ({ index, query }: FindingsBaseQuery) => {
  const {
    data,
    notifications: { toasts },
  } = useKibana().services;

  return useQuery(
    ['csp_findings_counts', { index, query }],
    () =>
      data.search
        .search<FindingsAggRequest, FindingsAggResponse>({
          params: {
            index,
            size: 0,
            track_total_hits: true,
            body: {
              query,
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
