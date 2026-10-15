/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useCallback, useMemo } from 'react';
import { useQuery } from '@kbn/react-query';
import { i18n } from '@kbn/i18n';
import { useErrorToast } from '../../../../../common/hooks/use_error_toast';
import { isAbortError } from '../../../../../common/utils/exceptions';
import type { QueryArgs, Row } from '../common';
import { ANOMALY_COUNT_FIELD, getNumber } from '../common';
import { findSortPageFetcher } from '../grid_columns';
import { buildEntitiesInViewCountQuery } from '../queries/entities_in_view';
import { createEsqlRunner } from '../queries/esql';
import { useEntityGridRowsEnrichment } from './use_entity_grid_rows_enrichment';
import {
  buildQueryArgs,
  getKeyScope,
  getReadyContext,
  getViewKey,
  useGridContext,
} from './use_entity_grid_context';
import type {
  EntityGridKeyScope,
  GridContext,
  RowsBatch,
  UseEntityGridDataOptions,
} from './use_entity_grid_context';

const GRID_QUERY_ERROR_TITLE = i18n.translate(
  'xpack.securitySolution.entityAnalytics.home.entitiesGrid.queryError',
  { defaultMessage: 'Error loading entities table' }
);

/** Most rows the grid loads, in one fetch: no pages to load more. */
export const MAX_LOADED_ROWS = 1_000;

/** Prefix of every query of expanded groups' records, e.g. for `useIsFetching`. */
export const ENTITY_GRID_CHILDREN_QUERY_KEY = ['entity-grid', 'children'] as const;

/**
 * How long loaded rows stay fresh. A group's records rarely change while it is expanded, so
 * prefetched records are still fresh when the row expands, and aren't read twice.
 */
const ROWS_STALE_TIME_MS: Readonly<Record<EntityGridKeyScope, number>> = {
  page: 0,
  children: 60_000,
};

const isAnomalySort = ({ sortField }: UseEntityGridDataOptions) =>
  sortField === ANOMALY_COUNT_FIELD;

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolves to `null` when the request fails, so the caller can fall back instead of failing.
 * An abort still rejects: the query key changed and the caller drops the result.
 */
const nullOnFailure = <T>(request: Promise<T>): Promise<T | null> =>
  request.catch((err) => {
    if (isAbortError(err)) throw err;
    return null;
  });

// ── query keys ────────────────────────────────────────────────────────────────

const getRowsKey = (context: GridContext, options: UseEntityGridDataOptions) =>
  [
    'entity-grid',
    getKeyScope(options),
    'rows',
    {
      ...getViewKey(context, options),
      sortDirection: options.sortDirection,
      pageSize: options.pageSize,
      keepFields: options.keepFields.join('\0'),
      // Only the anomaly sort reads the anomaly jobs; other sorts don't wait for them.
      anomalyJobIds: isAnomalySort(options) ? context.anomalyJobIds.join('\0') : '',
    },
  ] as const;

/**
 * The count is keyed by its query text: every sort counts the entities in view, so they share
 * one cached total per filter set. It must not embed time-dependent values.
 */
const getCountKey = (context: GridContext, options: UseEntityGridDataOptions, countQuery: string) =>
  ['entity-grid', getKeyScope(options), 'count', { spaceId: context.spaceId, countQuery }] as const;

// ── requests ──────────────────────────────────────────────────────────────────

/** The count query of the view, or `null` until the space and the index resolve. */
const buildCountQuery = (context: GridContext, options: UseEntityGridDataOptions) => {
  const ready = getReadyContext(context);
  return ready && buildEntitiesInViewCountQuery(buildQueryArgs(ready, options));
};

const fetchCount = async (
  { searchService }: GridContext,
  countQuery: string,
  signal?: AbortSignal
): Promise<number> => {
  const [countRow] = await createEsqlRunner(searchService, signal)(countQuery);
  return (countRow && getNumber(countRow, 'total')) ?? 0;
};

/**
 * The number of entities in view, which picks the sort query of a large view. Shares the
 * count query's cache. Without a count the view reads as small (0).
 */
const fetchViewSize = async (context: GridContext, options: UseEntityGridDataOptions) => {
  const countQuery = buildCountQuery(context, options);
  if (!countQuery) return 0;
  const count = await nullOnFailure(
    context.queryClient.fetchQuery({
      queryKey: getCountKey(context, options, countQuery),
      queryFn: ({ signal }) => fetchCount(context, countQuery, signal),
      staleTime: Infinity,
    })
  );
  return count ?? 0;
};

/** The rows plus one, from the sort column's query. */
const fetchSortRows = async (
  context: GridContext,
  options: UseEntityGridDataOptions,
  args: QueryArgs,
  signal?: AbortSignal
): Promise<Row[]> => {
  const fetchSortPage = findSortPageFetcher(options.sortField);
  if (!fetchSortPage) throw new Error(`Column ${options.sortField} is not sortable`);
  return fetchSortPage(args, {
    runQuery: createEsqlRunner(context.searchService, signal),
    fetchViewSize: () => fetchViewSize(context, options),
  });
};

/** The sort query reads one extra row, only to tell whether the view has more. */
const fetchRows = async (
  context: GridContext,
  options: UseEntityGridDataOptions,
  signal?: AbortSignal
): Promise<RowsBatch> => {
  const ready = getReadyContext(context);
  if (!ready) throw new Error('entities index not resolved');
  const args = buildQueryArgs(ready, options);
  const rowsWithLookahead = await fetchSortRows(context, options, args, signal);
  return {
    rows: rowsWithLookahead.slice(0, args.pageSize),
    hasMore: rowsWithLookahead.length > args.pageSize,
  };
};

// ── rows ──────────────────────────────────────────────────────────────────────

/** The options with no more rows than the grid loads. */
const limitPageSize = (options: UseEntityGridDataOptions): UseEntityGridDataOptions =>
  options.pageSize <= MAX_LOADED_ROWS ? options : { ...options, pageSize: MAX_LOADED_ROWS };

// ── hooks ─────────────────────────────────────────────────────────────────────

const useRowsQuery = (context: GridContext, options: UseEntityGridDataOptions) =>
  useQuery(getRowsKey(context, options), ({ signal }) => fetchRows(context, options, signal), {
    enabled:
      getReadyContext(context) != null && !(isAnomalySort(options) && context.isAnomalyJobsLoading),
    // Keep painting the loaded rows while a new sort or filter loads.
    keepPreviousData: true,
    staleTime: ROWS_STALE_TIME_MS[getKeyScope(options)],
  });

const useCountQuery = (context: GridContext, options: UseEntityGridDataOptions) => {
  const countQuery = buildCountQuery(context, options);
  return useQuery(
    getCountKey(context, options, countQuery ?? ''),
    ({ signal }) => (countQuery ? fetchCount(context, countQuery, signal) : Promise.resolve(0)),
    // No keepPreviousData: a stale unfiltered total would show next to filtered rows.
    { enabled: countQuery != null }
  );
};

/** Fetches the rows of any view ahead of time, e.g. a group's records on hover. */
const usePrefetch = (context: GridContext) =>
  useCallback(
    (viewOptions: UseEntityGridDataOptions) => {
      if (!getReadyContext(context)) return;
      const options = limitPageSize(viewOptions);
      void context.queryClient.prefetchQuery({
        queryKey: getRowsKey(context, options),
        queryFn: ({ signal }) => fetchRows(context, options, signal),
        staleTime: ROWS_STALE_TIME_MS[getKeyScope(options)],
      });
    },
    [context]
  );

/** The rows of the sort column's query, the count of the view, and the rows' computed columns. */
export const useEntityGridData = (viewOptions: UseEntityGridDataOptions) => {
  const options = useMemo(() => limitPageSize(viewOptions), [viewOptions]);
  const context = useGridContext();
  const rowsQuery = useRowsQuery(context, options);
  const countQuery = useCountQuery(context, options);
  const batches = useMemo(() => (rowsQuery.data ? [rowsQuery.data] : []), [rowsQuery.data]);
  const enrichment = useEntityGridRowsEnrichment(
    context,
    options,
    batches,
    rowsQuery.isPreviousData
  );
  const { rows } = enrichment;
  const prefetch = usePrefetch(context);
  useErrorToast(
    GRID_QUERY_ERROR_TITLE,
    context.entitiesIndexError ?? rowsQuery.error ?? countQuery.error ?? enrichment.error
  );

  return {
    rows,
    isEnriching: enrichment.isEnriching,
    total: countQuery.data ?? rows.length,
    updatedAt: Math.max(rowsQuery.dataUpdatedAt, enrichment.dataUpdatedAt) || null,
    isFetching:
      rowsQuery.isFetching ||
      countQuery.isFetching ||
      enrichment.isFetching ||
      context.isEntitiesIndexLoading,
    isAtLoadLimit: !!rowsQuery.data?.hasMore,
    prefetch,
  };
};
