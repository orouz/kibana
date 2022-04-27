/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { useQuery } from 'react-query';
import { lastValueFrom } from 'rxjs';
import type {
  EsQuerySortValue,
  IKibanaSearchRequest,
  IKibanaSearchResponse,
} from '@kbn/data-plugin/common';
import type * as estypes from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import { useEffect, useState } from 'react';
import { isEqual } from 'lodash';
import { useKibana } from '../../common/hooks/use_kibana';
import { showErrorToast } from './use_findings';
import type { FindingsBaseEsQuery, FindingsQueryResult, FindingsQueryStatus } from './types';

export interface UseFindingsByResourceOptions
  extends FindingsBaseEsQuery,
    FindingsQueryStatus,
    Omit<FindingsByResourceQuery, 'groupBy'> {}

export interface FindingsByResourceQuery {
  groupBy: 'resource';
  size: number;
  after?: FindingsByResourceAggregationsKeys;
  sort: EsQuerySortValue[];
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

const getSortKey = (sort: UseFindingsByResourceOptions['sort']) => {
  const [, direction] = Object.entries(sort[0])?.[0];
  return direction;
};

export const getFindingsByResourceAggQuery = ({
  index,
  query,
  size,
  after,
  sort,
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
            // @ts-expect-error
            { resource_id: { terms: { field: 'resource_id.keyword', order: getSortKey(sort) } } },
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
  sort,
}: UseFindingsByResourceOptions) => {
  const {
    data,
    notifications: { toasts },
  } = useKibana().services;

  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [afterKeys, setAfterKeys] = useState<FindingsByResourceAggregationsKeys[]>([]);

  const queryResult = useQuery(
    ['csp_findings_resource', { index, query, size, after, sort }],
    () =>
      lastValueFrom(
        data.search.search<FindingsAggRequest, FindingsAggResponse>({
          params: getFindingsByResourceAggQuery({ index, query, size, after, sort }),
        })
      ),
    {
      keepPreviousData: true,
      refetchOnWindowFocus: false,
      enabled,
      select: ({ rawResponse }) => ({
        after: rawResponse.aggregations?.groupBy?.after_key as
          | FindingsByResourceAggregationsKeys
          | undefined,
        total: rawResponse.hits.total as number,
        page: rawResponse.aggregations?.groupBy.buckets.map(createFindingsByResource) || [],
      }),
      onError: (err) => showErrorToast(toasts, err),
    }
  );

  const getNextKey = () => queryResult.data?.after;

  const getPreviousKey = () => {
    // when length is 0, we're on the 1st page, so no previous key
    // when length is 1, we're on the 2nd page, so previous key is 'undefined'
    if (afterKeys.length < 2) return undefined;

    // We need the 'after_key' from the page that points to the previous page
    return afterKeys[afterKeys.length - 2];
  };

  /**
   * Keeps track of pages we can go back to
   */
  useEffect(() => {
    if (!enabled) return;
    setAfterKeys((keys) => {
      if (!after) return [];
      const hasKeyBeenSeen = keys.some((key) => isEqual(key, after));

      return hasKeyBeenSeen
        ? keys.slice(0, -1) // We go back one at a time
        : [...keys, after];
    });
  }, [enabled, after]);

  /**
   * Keeps track of whether we have a next page
   * checks if the next response has an `after_key`
   * if it doesn't, then we already have the last page with data, and we disable the 'next' button
   * NOTE: this is wasteful, but makes a better UX
   */
  useEffect(() => {
    if (!enabled) return;
    lastValueFrom(
      data.search.search<FindingsAggRequest, FindingsAggResponse>({
        params: getFindingsByResourceAggQuery({
          index,
          query,
          size,
          after: queryResult.data?.after,
          sort,
        }),
      })
    ).then((nextResult) =>
      setHasNextPage(!!nextResult?.rawResponse?.aggregations?.groupBy?.after_key)
    );
  }, [enabled, data.search, index, query, queryResult.data, size, sort]);

  return {
    ...queryResult,
    getNextKey,
    getPreviousKey,
    hasPrevPage: afterKeys.length >= 1,
    hasNextPage,
  };
};

export const createFindingsByResource = (bucket: FindingsAggBucket) => ({
  ...bucket.key,
  failed_findings: {
    total: bucket.failed_findings.doc_count,
    normalized: bucket.doc_count > 0 ? bucket.failed_findings.doc_count / bucket.doc_count : 0,
  },
});
