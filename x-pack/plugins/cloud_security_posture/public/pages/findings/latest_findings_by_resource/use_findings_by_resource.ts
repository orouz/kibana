/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { useQuery } from 'react-query';
import { lastValueFrom } from 'rxjs';
import { IKibanaSearchRequest, IKibanaSearchResponse } from '@kbn/data-plugin/common';
import type * as estypes from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import type { Pagination } from '@elastic/eui';
import { useKibana } from '../../../common/hooks/use_kibana';
import { showErrorToast } from '../latest_findings/use_latest_findings';
import type { FindingsBaseEsQuery, FindingsQueryResult } from '../types';

// a large number to probably get all the buckets
const MAX_BUCKETS = 60 * 1000;

interface UseResourceFindingsOptions extends FindingsBaseEsQuery {
  from: NonNullable<estypes.SearchRequest['from']>;
  size: NonNullable<estypes.SearchRequest['size']>;
}

export interface FindingsByResourceQuery {
  pageIndex: Pagination['pageIndex'];
  pageSize: Pagination['pageSize'];
}

type FindingsAggRequest = IKibanaSearchRequest<estypes.SearchRequest>;
type FindingsAggResponse = IKibanaSearchResponse<
  estypes.SearchResponse<{}, FindingsByResourceAggs>
>;

export type CspFindingsByResourceResult = FindingsQueryResult<
  ReturnType<typeof useFindingsByResource>['data'],
  unknown
>;

interface FindingsByResourceAggs {
  resource_total: estypes.AggregationsCardinalityAggregate;
  resources: estypes.AggregationsMultiBucketAggregateBase<FindingsAggBucket>;
}

interface FindingsAggBucket extends estypes.AggregationsStringRareTermsBucketKeys {
  failed_findings: estypes.AggregationsMultiBucketBase;
  cis_sections: estypes.AggregationsMultiBucketAggregateBase<estypes.AggregationsStringRareTermsBucketKeys>;
}

export const getFindingsByResourceAggQuery = ({
  index,
  query,
  from,
  size,
}: UseResourceFindingsOptions): estypes.SearchRequest => ({
  index,
  body: {
    query,
    size: 0,
    aggs: {
      resource_total: { cardinality: { field: 'resource.id.keyword' } },
      resources: {
        terms: { field: 'resource.id.keyword', size: MAX_BUCKETS },
        aggs: {
          cis_sections: {
            terms: { field: 'rule.section.keyword' },
          },
          failed_findings: {
            filter: { term: { 'result.evaluation.keyword': 'failed' } },
          },
          sort_failed_findings: {
            bucket_sort: {
              from,
              size,
              sort: [{ 'failed_findings>_count': { order: 'desc' } }],
            },
          },
        },
      },
    },
  },
});

export const useFindingsByResource = ({ index, query, from, size }: UseResourceFindingsOptions) => {
  const {
    data,
    notifications: { toasts },
  } = useKibana().services;

  return useQuery(
    ['csp_findings_resource', { index, query, size, from }],
    () =>
      lastValueFrom(
        data.search.search<FindingsAggRequest, FindingsAggResponse>({
          params: getFindingsByResourceAggQuery({ index, query, from, size }),
        })
      ).then(({ rawResponse: { aggregations } }) => {
        if (!aggregations) throw new Error('expected aggregations to be defined');

        if (!Array.isArray(aggregations.resources.buckets))
          throw new Error('expected resources buckets to be an array');

        return {
          page: aggregations.resources.buckets.map(createFindingsByResource),
          total: aggregations.resource_total.value,
        };
      }),
    {
      keepPreviousData: true,
      onError: (err) => showErrorToast(toasts, err),
    }
  );
};

const createFindingsByResource = (bucket: FindingsAggBucket) => {
  if (!Array.isArray(bucket.cis_sections.buckets))
    throw new Error('expected buckets to be an array');

  return {
    resource_id: bucket.key,
    cis_sections: bucket.cis_sections.buckets.map((v) => v.key),
    failed_findings: {
      total: bucket.failed_findings.doc_count,
      normalized: bucket.doc_count > 0 ? bucket.failed_findings.doc_count / bucket.doc_count : 0,
    },
  };
};
