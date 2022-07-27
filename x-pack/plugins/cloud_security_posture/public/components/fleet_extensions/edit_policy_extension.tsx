/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { memo } from 'react';
import { EuiDescribedFormGroup, EuiForm } from '@elastic/eui';
import type { PackagePolicyCreateExtensionComponentProps } from '@kbn/fleet-plugin/public';
import { DeploymentTypeSelect, getEnabledInputType } from './deployment_type_select';

export const CspEditPolicyExtension = memo<PackagePolicyCreateExtensionComponentProps>(
  ({ newPolicy }) => {
    const selectedDeploymentType = getEnabledInputType(newPolicy.inputs);

    return (
      <EuiForm style={{ paddingBottom: 40 }}>
        <EuiDescribedFormGroup title={<div />}>
          <DeploymentTypeSelect type={selectedDeploymentType} />
        </EuiDescribedFormGroup>
      </EuiForm>
    );
  }
);

CspEditPolicyExtension.displayName = 'CspEditPolicyExtension';

// eslint-disable-next-line import/no-default-export
export { CspEditPolicyExtension as default };
