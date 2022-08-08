/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import type { NewPackagePolicyInput } from '@kbn/fleet-plugin/common';
import { CLOUDBEAT_EKS } from '../../../common/constants';

export const isEksInput = (input: NewPackagePolicyInput) => input.type === CLOUDBEAT_EKS;

// TODO: remove access to first stream
export const getUpdatedStreamVars = (item: NewPackagePolicyInput, key: string, value: string) => {
  if (!item.streams[0]) return item;

  return {
    ...item,
    streams: [
      {
        ...item.streams[0],
        vars: {
          ...item.streams[0]?.vars,
          [key]: {
            ...item.streams[0]?.vars?.[key],
            value,
          },
        },
      },
    ],
  };
};
