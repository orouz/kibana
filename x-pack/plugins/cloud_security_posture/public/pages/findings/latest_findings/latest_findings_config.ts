/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import type { IKibanaSearchResponse } from '@kbn/data-plugin/common';
import type * as estypes from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import { number } from 'io-ts';
import { CspFinding } from '../../../../common/schemas/csp_finding';
import type { FindingsBaseURLQuery, FindingsCountAggregation, Sort } from '../types';
import { getAggregationCount, getFindingsCountAggQuery } from '../utils/utils';
import { CSP_LATEST_FINDINGS_DATA_VIEW } from '../../../../common/constants';
import { MAX_FINDINGS_TO_LOAD } from '../../../common/constants';

interface LatestFindingsQuery extends FindingsBaseURLQuery {
  sort: Sort<CspFinding>;
}

export const getDefaultUrlQuery = ({
  query,
  filters,
}: FindingsBaseURLQuery): LatestFindingsQuery => ({
  query,
  filters,
  sort: { field: '@timestamp', direction: 'desc' },
  pageIndex: 0,
});

export const getEsRequest = ({
  esQuery,
  urlQuery: { sort },
}: {
  urlQuery: LatestFindingsQuery;
  esQuery: any;
}) => ({
  index: CSP_LATEST_FINDINGS_DATA_VIEW,
  body: {
    query: esQuery.query,
    sort: [{ [sort.field]: sort.direction }],
    size: MAX_FINDINGS_TO_LOAD,
    aggs: getFindingsCountAggQuery(),
  },
  ignore_unavailable: false,
});

export const getEsResult = ({
  rawResponse,
}: IKibanaSearchResponse<estypes.SearchResponse<CspFinding, FindingsCountAggregation>>) => {
  const { aggregations, hits } = rawResponse;
  if (!aggregations) throw new Error('expected aggregations to be an defined');
  if (!Array.isArray(aggregations.count.buckets))
    throw new Error('expected buckets to be an array');

  return {
    page: hits.hits.map((hit) => hit._source!),
    total: number.is(hits.total) ? hits.total : 0,
    count: getAggregationCount(aggregations.count.buckets),
  };
};
