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
import { useEffect, useState } from 'react';
import { isEqual } from 'lodash';
import { useKibana } from '../../common/hooks/use_kibana';
import { showErrorToast } from './use_findings';
import type { FindingsBaseEsQuery, FindingsQueryResult, FindingsQueryStatus } from './types';

// TODO: what happens if user lands with an after key that is
// OLD - ?
// doesn't exist - ?
// in the middle - previous available from the start, goes to first after

// when moving from one page to the next, we need to remove the previous page query from the url

export interface UseFindingsByResourceOptions
  extends FindingsBaseEsQuery,
    FindingsQueryStatus,
    FindingsByResourceQuery {}

export interface FindingsByResourceQuery {
  size: number;
  after?: FindingsByResourceAggregationsKeys;
}

type FindingsAggRequest = IKibanaSearchRequest<estypes.SearchRequest>;
type FindingsAggResponse = IKibanaSearchResponse<
  estypes.SearchResponse<{}, FindingsByResourceAggs>
>;

export type CspFindingsByResourceResult = FindingsQueryResult<
  ReturnType<typeof useFindingsByResource>['data'] | undefined,
  unknown
>;

interface FindingsByResourceAggs {
  groupBy: {
    buckets: FindingsAggBucket[];
  } & estypes.AggregationsCompositeAggregate;
}

export type FindingsByResourceAggregationsKeys = Record<
  'resource_id' | 'cluster_id' | 'cis_section',
  string
>;

export interface FindingsAggBucket {
  doc_count: number;
  failed_findings: { doc_count: number };
  key: FindingsByResourceAggregationsKeys;
}

export const getFindingsByResourceAggQuery = ({
  index,
  query,
  size,
  after,
}: Omit<UseFindingsByResourceOptions, 'enabled'>): estypes.SearchRequest => ({
  index,
  size: 0,
  body: {
    query,
    aggs: {
      groupBy: {
        composite: {
          size,
          after,
          sources: [
            { resource_id: { terms: { field: 'resource_id.keyword' } } },
            { cluster_id: { terms: { field: 'cluster_id.keyword' } } },
            { cis_section: { terms: { field: 'rule.section' } } },
          ],
        },
        aggs: {
          failed_findings: {
            filter: { term: { 'result.evaluation.keyword': 'failed' } },
          },
        },
      },
    },
  },
});

export const useFindingsByResource = ({
  enabled,
  index,
  query,
  size,
  after,
}: UseFindingsByResourceOptions) => {
  const {
    data,
    notifications: { toasts },
  } = useKibana().services;

  const [afterKeys, setAfterKeys] = useState<FindingsByResourceAggregationsKeys[]>([]);

  /**
   * Keeps track of pages we can go back to
   */
  useEffect(() => {
    setAfterKeys((keys) => {
      if (!after) return [];
      const hasKeyBeenSeen = keys.some((key) => isEqual(key, after));

      return hasKeyBeenSeen
        ? keys.slice(0, -1) // We go back one at a time
        : [...keys, after];
    });
  }, [after]);

  const queryResult = useQuery(
    ['csp_findings_resource', { index, query, size, after }],
    () =>
      lastValueFrom(
        data.search.search<FindingsAggRequest, FindingsAggResponse>({
          params: getFindingsByResourceAggQuery({ index, query, size, after }),
        })
      ),
    {
      keepPreviousData: true,
      refetchOnWindowFocus: false,
      enabled,
      select: ({ rawResponse }) => ({
        after: rawResponse.aggregations?.groupBy?.after_key,
        total: rawResponse.hits.total as number,
        page: rawResponse.aggregations?.groupBy.buckets.map(createFindingsByResource) || [],
      }),
      onError: (err) => showErrorToast(toasts, err),
    }
  );

  const getNextKey = () => {
    // TODO: account for last page
    // the last 'after' key we get back leads to an empty page
    // so we check if this key is the same as the last item in the array
    // ???????
    return queryResult.data?.after as FindingsByResourceAggregationsKeys;
  };

  const getPreviousKey = () => {
    // when afterKeys.length is 0, we're on the 1st page, so no previous key
    // when afterKeys.length is 1, we're at 2nd page, previous key is 'undefined'
    if (afterKeys.length < 2) return undefined;

    // We need the 'after_key' from the page that points to the previous page
    return afterKeys[afterKeys.length - 2];
  };

  return {
    ...queryResult,
    getNextKey,
    getPreviousKey,
    hasPrevPage: afterKeys.length >= 1,
    hasNextPage: queryResult.data?.after !== undefined, // TODO: check if there is a next page
  };
};

export const createFindingsByResource = (bucket: FindingsAggBucket) => ({
  ...bucket.key,
  failed_findings: {
    total: bucket.failed_findings.doc_count,
    normalized: bucket.doc_count > 0 ? bucket.failed_findings.doc_count / bucket.doc_count : 0,
  },
});
