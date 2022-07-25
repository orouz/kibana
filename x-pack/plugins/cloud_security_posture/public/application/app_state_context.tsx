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
import { History } from 'history';
import { useKibana } from '../common/hooks/use_kibana';

interface AppState {
  filters: Filter[];
  query: Query;
  sort: { field: string; direction: 'desc' | 'asc' };
  pageIndex: number;
  pageSize: number;
}

const defaultState: AppState = {
  filters: [],
  query: { language: 'kuery', query: '' },
  sort: { field: '@timestamp', direction: 'desc' },
  pageIndex: 0,
  pageSize: 10,
};

const APP_STORAGE_KEY = '_a';

type AppStateContainer = ReduxLikeStateContainer<AppState, {}, {}>;

interface AppContext {
  state: AppState;
  setState(state: Partial<AppState>): void;
}

const AppContext = React.createContext<AppContext>(null as any);
export const useAppContext = () => React.useContext(AppContext);
export const useAppContextWithPageDefaults = <T extends Partial<AppState>>(defaults: T) => {
  const ctx = useAppContext();
  const { setState } = ctx;

  useEffect(() => {
    setState(defaults);
    // setState,  infinite loop[]
  }, [defaults]);

  return ctx as { state: AppState & T; setState(v: Partial<AppState & T>): void };
};

export const AppContextProvider: React.FC<{ history: History }> = ({ children, history }) => {
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

  const initialStateFromUrl = useMemo(
    () => urlStateStorage.get<AppState>(APP_STORAGE_KEY),
    [urlStateStorage]
  );

  const initialState = useMemo(
    () => ({
      ...defaultState,
      ...initialStateFromUrl,
    }),
    [initialStateFromUrl]
  );

  const stateContainer = useMemo(() => createStateContainer(initialState), [initialState]);

  useAppGlobalStateSync({ query: data.query, urlStateStorage });
  useAppLocalStateSync({
    query: data.query,
    urlStateStorage,
    stateContainer,
    initialState,
  });

  useEffect(() => {
    if (!initialStateFromUrl) {
      urlStateStorage.set(APP_STORAGE_KEY, initialState, { replace: true });
    }
  }, [initialState, initialStateFromUrl, urlStateStorage]);

  const state = useContainerState(stateContainer);
  const value = useMemo(
    () => ({
      state,
      setState: (s: Partial<AppState>) => stateContainer.set({ ...state, ...s }),
    }),
    [state, stateContainer]
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

/**
 * Sync global state with URL
 */
const useAppGlobalStateSync = ({
  query,
  urlStateStorage,
}: {
  query: QueryStart;
  urlStateStorage: IKbnUrlStateStorage;
}) => {
  useEffect(() => {
    const { stop } = syncGlobalQueryStateWithUrl(query, urlStateStorage);
    return () => {
      stop();
    };
  }, [query, urlStateStorage]);
};

/**
 * Sync local state with URL
 */
const useAppLocalStateSync = ({
  stateContainer,
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
        storageKey: APP_STORAGE_KEY,
        stateContainer: {
          ...stateContainer,
          set: (state) => {
            //   stateContainer.set({ ...defaultState, ...stateContainer.getState(), ...state });

            urlStateStorage.set(
              APP_STORAGE_KEY,
              { ...defaultState, ...stateContainer.getState(), ...state },
              { replace: true }
            );
          },
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
