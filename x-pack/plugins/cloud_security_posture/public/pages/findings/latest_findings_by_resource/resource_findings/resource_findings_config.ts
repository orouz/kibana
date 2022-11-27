/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { IKibanaSearchResponse } from '@kbn/data-plugin/common';
import type * as estypes from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import { Pagination } from '@elastic/eui';
import { number } from 'io-ts';
import { CspFinding } from '../../../../../common/schemas/csp_finding';
import { getAggregationCount, getFindingsCountAggQuery } from '../../utils/utils';
import type { FindingsBaseURLQuery, FindingsEsQuery, Sort } from '../../types';
import { CSP_LATEST_FINDINGS_DATA_VIEW } from '../../../../../common/constants';
import { MAX_FINDINGS_TO_LOAD } from '../../../../common/constants';

interface ResourceFindingsQuery {
  pageIndex: Pagination['pageIndex'];
  sort: Sort<CspFinding>;
}

type ResourceFindingsResponse = IKibanaSearchResponse<
  estypes.SearchResponse<CspFinding, ResourceFindingsResponseAggs>
>;

export type ResourceFindingsResponseAggs = Record<
  'count' | 'clusterId' | 'resourceSubType' | 'resourceName',
  estypes.AggregationsMultiBucketAggregateBase<estypes.AggregationsStringRareTermsBucketKeys>
>;

export const getDefaultQuery = ({
  query,
  filters,
}: FindingsBaseURLQuery): FindingsBaseURLQuery & ResourceFindingsQuery => ({
  query,
  filters,
  sort: { field: 'result.evaluation' as keyof CspFinding, direction: 'asc' },
  pageIndex: 0,
});

export const getEsRequest = ({
  urlQuery,
  urlParams,
  esQuery,
}: {
  urlParams: { resourceId: string };
  urlQuery: FindingsBaseURLQuery & ResourceFindingsQuery;
  esQuery: FindingsEsQuery;
}): estypes.SearchRequest => ({
  index: CSP_LATEST_FINDINGS_DATA_VIEW,
  body: {
    size: MAX_FINDINGS_TO_LOAD,
    query: {
      ...esQuery.query,
      bool: {
        ...esQuery.query?.bool,
        filter: [
          ...(esQuery.query?.bool?.filter || []),
          { term: { 'resource.id': urlParams.resourceId } },
        ],
      },
    },
    sort: [{ [urlQuery.sort.field]: urlQuery.sort.direction }],
    aggs: {
      ...getFindingsCountAggQuery(),
      clusterId: {
        terms: { field: 'cluster_id' },
      },
      resourceSubType: {
        terms: { field: 'resource.sub_type' },
      },
      resourceName: {
        terms: { field: 'resource.name' },
      },
    },
  },
  ignore_unavailable: false,
});

export const getEsResult = ({ rawResponse: { hits, aggregations } }: ResourceFindingsResponse) => {
  if (!aggregations) throw new Error('expected aggregations to exists');

  assertNonEmptyArray(aggregations.count.buckets);
  assertNonEmptyArray(aggregations.clusterId.buckets);
  assertNonEmptyArray(aggregations.resourceSubType.buckets);
  assertNonEmptyArray(aggregations.resourceName.buckets);

  return {
    page: hits.hits.map((hit) => hit._source!),
    total: number.is(hits.total) ? hits.total : 0,
    count: getAggregationCount(aggregations.count.buckets),
    clusterId: getFirstBucketKey(aggregations.clusterId.buckets),
    resourceSubType: getFirstBucketKey(aggregations.resourceSubType.buckets),
    resourceName: getFirstBucketKey(aggregations.resourceName.buckets),
  };
};

function assertNonEmptyArray<T>(arr: unknown): asserts arr is T[] {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('expected a non empty array');
  }
}

const getFirstBucketKey = (buckets: estypes.AggregationsStringRareTermsBucketKeys[]) =>
  buckets[0].key;
