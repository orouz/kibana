/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { useQuery } from '@tanstack/react-query';
import { lastValueFrom } from 'rxjs';
import type { IKibanaSearchRequest, IKibanaSearchResponse } from '@kbn/data-plugin/common';
import type { CoreStart } from '@kbn/core/public';
import type * as estypes from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import { i18n } from '@kbn/i18n';
import { useUrlQuery } from '../../common/hooks/use_url_query';
import { extractErrorMessage } from '../../../common/utils/helpers';
import type { FindingsBaseURLQuery, FindingsEsQuery } from './types';
import { useKibana } from '../../common/hooks/use_kibana';
import { useBaseEsQuery, usePersistedQuery } from './utils/utils';

export interface UseFindingsOptions<
  UrlParams,
  Doc,
  T extends FindingsBaseURLQuery,
  E extends { urlQuery: T; esQuery: any; urlParams?: UrlParams },
  Aggregation,
  Response extends IKibanaSearchResponse<estypes.SearchResponse<Doc, Aggregation>>,
  Result
> {
  urlParams?: UrlParams;
  dataView: any;
  getDefaultUrlQuery(base: FindingsBaseURLQuery): T;
  getEsRequest(query: E): IKibanaSearchRequest<estypes.SearchRequest>['params'];
  getEsResult(response: Response): Result;
}

const SEARCH_FAILED_TEXT = i18n.translate(
  'xpack.csp.findings.findingsErrorToast.searchFailedTitle',
  { defaultMessage: 'Search failed' }
);

const showErrorToast = (toasts: CoreStart['notifications']['toasts'], error: unknown): void => {
  if (error instanceof Error) toasts.addError(error, { title: SEARCH_FAILED_TEXT });
  else toasts.addDanger(extractErrorMessage(error, SEARCH_FAILED_TEXT));
};

export const useFindings = <
  UrlParams,
  Doc,
  T extends FindingsBaseURLQuery,
  E extends { urlQuery: T; esQuery: FindingsEsQuery; urlParams?: UrlParams },
  Aggregation,
  Response extends IKibanaSearchResponse<estypes.SearchResponse<Doc, Aggregation>>,
  Result
>(
  options: UseFindingsOptions<UrlParams, Doc, T, E, Aggregation, Response, Result>
) => {
  const {
    data,
    notifications: { toasts },
  } = useKibana().services;

  const getPersistedDefaultQuery = usePersistedQuery(options.getDefaultUrlQuery);
  const { urlQuery, setUrlQuery } = useUrlQuery(getPersistedDefaultQuery);

  const baseEsQuery = useBaseEsQuery({
    dataView: options.dataView,
    filters: urlQuery.filters,
    query: urlQuery.query,
  });

  const requestParams = options.getEsRequest({
    urlQuery,
    esQuery: baseEsQuery,
    urlParams: options.urlParams,
  } as E);

  const result = useQuery(
    ['findings', { params: requestParams }],
    async () => {
      if (baseEsQuery.error) {
        throw new Error(baseEsQuery.error.message);
      }
      const response: Response = await lastValueFrom(
        data.search.search({
          params: requestParams,
        })
      );

      const esResult = options.getEsResult(response);
      return esResult;
    },
    {
      keepPreviousData: true,
      onError: (err: Error) => showErrorToast(toasts, err),
    }
  );

  return {
    setUrlQuery,
    urlQuery,
    result,
  };
};
