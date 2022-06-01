/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { useQuery } from 'react-query';
import { lastValueFrom } from 'rxjs';
import { IEsSearchResponse } from '@kbn/data-plugin/common';
import type * as estypes from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import { Pagination } from '@elastic/eui';
import { useContext } from 'react';
import { number } from 'io-ts';
import { FindingsEsPitContext } from '../../es_pit/findings_es_pit_context';
import { FINDINGS_REFETCH_INTERVAL_MS } from '../../constants';
import { useKibana } from '../../../../common/hooks/use_kibana';
import { showErrorToast } from '../../latest_findings/use_latest_findings';
import type { CspFinding, FindingsBaseEsQuery } from '../../types';

interface UseResourceFindingsOptions extends FindingsBaseEsQuery {
  resourceId: string;
  from: NonNullable<estypes.SearchRequest['from']>;
  size: NonNullable<estypes.SearchRequest['size']>;
  enabled: boolean;
}

export interface ResourceFindingsQuery {
  pageIndex: Pagination['pageIndex'];
  pageSize: Pagination['pageSize'];
}

const getResourceFindingsQuery = ({
  query,
  resourceId,
  from,
  size,
  pitId,
}: UseResourceFindingsOptions & { pitId: string }): estypes.SearchRequest => ({
  from,
  size,
  body: {
    query: {
      ...query,
      bool: {
        ...query?.bool,
        filter: [...(query?.bool?.filter || []), { term: { 'resource_id.keyword': resourceId } }],
      },
    },
    pit: { id: pitId },
  },
  ignore_unavailable: false,
});

export const useResourceFindings = (options: UseResourceFindingsOptions) => {
  const {
    data,
    notifications: { toasts },
  } = useKibana().services;

  const { pitIdRef, setPitId } = useContext(FindingsEsPitContext);
  const pitId = pitIdRef.current;

  return useQuery(
    ['csp_resource_findings', { options }],
    () =>
      lastValueFrom(
        data.search.search({
          params: getResourceFindingsQuery({ ...options, pitId }),
        })
      ),
    {
      enabled: options.enabled,
      keepPreviousData: true,
      select: ({ rawResponse: { hits, pit_id: newPitId } }: IEsSearchResponse<CspFinding>) => ({
        page: hits.hits.map((hit) => hit._source!),
        total: number.is(hits.total) ? hits.total : 0,
        newPitId: newPitId!,
      }),
      onError: (err: Error) => showErrorToast(toasts, err),
      onSuccess: ({ newPitId }) => {
        setPitId(newPitId);
      },
      // Refetching on an interval to ensure the PIT window stays open
      refetchInterval: FINDINGS_REFETCH_INTERVAL_MS,
      refetchIntervalInBackground: true,
    }
  );
};
