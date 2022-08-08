/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React, { memo } from 'react';
import type { PackagePolicyEditExtensionComponentProps } from '@kbn/fleet-plugin/public';
import { CspFleetPolicyExtensionForm } from './policy_extension_form';

export const CspEditPolicyExtension = memo<PackagePolicyEditExtensionComponentProps>(
  ({ newPolicy, onChange }) => (
    <CspFleetPolicyExtensionForm type="edit" newPolicy={newPolicy} onChange={onChange} />
  )
);

CspEditPolicyExtension.displayName = 'CspEditPolicyExtension';

// eslint-disable-next-line import/no-default-export
export { CspEditPolicyExtension as default };
