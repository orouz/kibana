/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useContext } from 'react';

import type { UIExtensionPoint, UIExtensionsStorage } from '../types';

export const UIExtensionsContext = React.createContext<UIExtensionsStorage>({});

type NarrowExtensionPoint<V extends UIExtensionPoint['view'], A = UIExtensionPoint> = A extends {
  view: V;
}
  ? A
  : never;

type ExclusiveExtensions<T extends ReadonlyArray<UIExtensionPoint['view']>> =
  | ReplaceWithUndefined<T, 'package-policy-edit' | 'package-policy-create'>
  | ReplaceWithUndefined<T, 'package-policy-replace-define-step'>;

type ReplaceWithUndefined<Tuple extends readonly unknown[], Id> = Tuple extends readonly []
  ? []
  : Tuple extends readonly [infer Head, ...infer Rest]
  ? Head extends Id
    ? readonly [undefined, ...ReplaceWithUndefined<Rest, Id>]
    : Head extends UIExtensionPoint['view']
    ? readonly [NarrowExtensionPoint<Head> | undefined, ...ReplaceWithUndefined<Rest, Id>]
    : never
  : Tuple;

export function useUIExtension<
  V extends ReadonlyArray<UIExtensionPoint['view']> = ReadonlyArray<UIExtensionPoint['view']>
>(packageName: UIExtensionPoint['package'], view: V): ExclusiveExtensions<V>;

export function useUIExtension<V extends UIExtensionPoint['view'] = UIExtensionPoint['view']>(
  packageName: UIExtensionPoint['package'],
  view: V
): NarrowExtensionPoint<V> | undefined;

export function useUIExtension<V extends UIExtensionPoint['view']>(
  packageName: UIExtensionPoint['package'],
  view: V | readonly V[]
) {
  const registeredExtensions = useContext(UIExtensionsContext);
  if (!registeredExtensions) {
    throw new Error('useUIExtension called outside of UIExtensionsContext');
  }

  if (typeof view === 'string') {
    const extension = registeredExtensions?.[packageName]?.[view];
    return extension;
  }

  return view.map((v) => registeredExtensions?.[packageName]?.[v]);
}
