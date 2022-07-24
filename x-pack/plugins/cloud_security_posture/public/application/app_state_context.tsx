/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  connectToQueryState,
  QueryStart,
  syncGlobalQueryStateWithUrl,
} from '@kbn/data-plugin/public';
import { Filter, FilterStateStore, Query } from '@kbn/es-query';
import React, { useEffect, useMemo } from 'react';

import {
  createStateContainer,
  createKbnUrlStateStorage,
  withNotifyOnErrors,
  ReduxLikeStateContainer,
  IKbnUrlStateStorage,
  syncStates,
  useContainerState,
} from '@kbn/kibana-utils-plugin/public';
import { useKibana } from '../common/hooks/use_kibana';

interface AppState {
  filters: Filter[];
  query: Query;
}

const defaultState: AppState = {
  filters: [],
  query: { language: 'kuery', query: '' },
};

type AppStateContainer = ReduxLikeStateContainer<AppState, {}, {}>;

interface AppContext {
  state: AppState;
  setState(state: Partial<AppState>): void;
}

const AppContext = React.createContext<AppContext>(null as any);
export const useAppContext = () => React.useContext(AppContext);

export const AppContextProvider: React.FC = ({ children, history }) => {
  const {
    notifications: { toasts },
    data,
  } = useKibana().services;

  const urlStateStorage = useMemo(
    () =>
      createKbnUrlStateStorage({
        history,
        useHash: false,
        ...(toasts && withNotifyOnErrors(toasts)),
      }),
    [toasts, history]
  );

  const initialStateFromUrl = useMemo(() => urlStateStorage.get<AppState>('_a'), [urlStateStorage]);

  const initialState = useMemo(
    () => ({
      ...defaultState,
      ...initialStateFromUrl,
    }),
    [initialStateFromUrl]
  );

  const stateContainer = useMemo(() => createStateContainer(initialState), [initialState]);
  const pageStateContainer = useMemo(() => createStateContainer({ rows: 10 }), []);

  useAppGlobalStateSync({ query: data.query, urlStateStorage });
  useAppLocalStateSync({
    query: data.query,
    urlStateStorage,
    stateContainer,
    initialState,
    pageStateContainer,
  });

  useEffect(() => {
    if (!initialStateFromUrl) {
      urlStateStorage.set('_a', initialState, { replace: true });
    }
  }, [initialState, initialStateFromUrl, urlStateStorage]);

  const state = useContainerState(stateContainer);
  const value = useMemo(
    () => ({
      state,
      setState: stateContainer.set,
    }),
    [state, stateContainer.set]
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

const useAppGlobalStateSync = ({
  query,
  urlStateStorage,
}: {
  query: QueryStart;
  urlStateStorage: IKbnUrlStateStorage;
}) => {
  useEffect(() => {
    const { stop } = syncGlobalQueryStateWithUrl(query, urlStateStorage);
    return () => stop();
  }, [query, urlStateStorage]);
};

const useAppLocalStateSync = ({
  stateContainer,
  pageStateContaine,
  urlStateStorage,
  query,
}: {
  query: QueryStart;
  stateContainer: AppStateContainer;
  urlStateStorage: IKbnUrlStateStorage;
  initialState: AppState;
}) => {
  useEffect(() => {
    // sync app filters with app state container from data.query to state container
    const stopSyncingQueryAppStateWithStateContainer = connectToQueryState(query, stateContainer, {
      filters: FilterStateStore.APP_STATE,
      query: true,
    });

    // sets up syncing app state container with url
    const { start: startAppStateUrlSync, stop: stopAppStateUrlSync } = syncStates([
      {
        storageKey: '_a',
        stateContainer: {
          ...stateContainer,
          set: (state) => {
            //   stateContainer.set({ ...defaultState, ...stateContainer.getState(), ...state });

            urlStateStorage.set(
              '_a',
              { ...defaultState, ...stateContainer.getState(), ...state },
              { replace: true }
            );
          },
        },
        stateStorage: urlStateStorage,
      },
      {
        storageKey: '_p',
        stateContainer: {
          ...pageStateContainer,
          set: (s) => s && pageStateContainer.set(s),
        },
        stateStorage: urlStateStorage,
      },
    ]);

    startAppStateUrlSync();

    return () => {
      stopSyncingQueryAppStateWithStateContainer();
      stopAppStateUrlSync();
    };
  }, [query, stateContainer, urlStateStorage]);
};
