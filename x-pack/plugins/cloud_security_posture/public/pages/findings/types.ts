/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { estypes } from '@elastic/elasticsearch';
import type { Criteria } from '@elastic/eui';
import type { DataView } from '@kbn/data-views-plugin/common';
import type { BoolQuery, Filter, Query } from '@kbn/es-query';

export type FindingsGroupByKind = 'default' | 'resource';

/**
 * Common URL Query Params
 */
export interface FindingsBaseURLQuery {
  pageIndex: number;
  query: Query;
  filters: Filter[];
}

export interface FindingsBaseProps {
  dataView: DataView;
}

/**
 * Result of URL Query
 */
export interface FindingsEsQuery {
  query?: {
    bool: BoolQuery;
  };
}

export type Sort<T> = NonNullable<Criteria<T>['sort']>;

export interface FindingsCountAggregation {
  count: estypes.AggregationsMultiBucketAggregateBase<estypes.AggregationsStringRareTermsBucketKeys>;
}

export type FindingsResult<T> = {
  total: number;
  count: Record<'passed' | 'failed', number>;
  page: T[];
};
