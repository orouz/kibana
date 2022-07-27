/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { memo } from 'react';
import { EuiDescribedFormGroup, EuiForm, EuiSpacer } from '@elastic/eui';
import type { PackagePolicyCreateExtensionComponentProps } from '@kbn/fleet-plugin/public';
import type { NewPackagePolicyInput, NewPackagePolicyInputStream } from '@kbn/fleet-plugin/common';
import { CLOUDBEAT_EKS } from '../../../common/constants';
import { DeploymentTypeSelect, getEnabledInputType, InputType } from './deployment_type_select';
import { EksForm, isEksInput } from './eks_form';

const getUpdatedStreamVars = (
  stream: NewPackagePolicyInputStream,
  varKey: string,
  varValue: string
) => ({
  ...stream,
  vars: {
    ...stream?.vars,
    [varKey]: {
      ...stream?.vars?.[varKey],
      value: varValue,
    },
  },
});

export const CspCreatePolicyExtension = memo<PackagePolicyCreateExtensionComponentProps>(
  ({ newPolicy, onChange }) => {
    const selectedDeploymentType = getEnabledInputType(newPolicy.inputs);

    const updatePolicyInputs = (inputs: NewPackagePolicyInput[]) => ({
      isValid: true, // TODO: add validations
      updatedPolicy: { ...newPolicy, inputs },
    });

    /**
     * Ensures a single enabled input
     */
    const updateDeploymentType = (inputType: InputType) =>
      updatePolicyInputs(
        newPolicy.inputs.map((item) => ({ ...item, enabled: item.type === inputType }))
      );

    /**
     * Updates the first EKS input data-stream vars object
     */
    const updateEksVar = (varKey: string, varValue: string) =>
      updatePolicyInputs(
        newPolicy.inputs.map((item) =>
          isEksInput(item)
            ? // TODO: remove access to first stream
              { ...item, streams: [getUpdatedStreamVars(item.streams[0], varKey, varValue)] }
            : item
        )
      );

    return (
      <EuiForm style={{ paddingBottom: 40 }}>
        <EuiDescribedFormGroup title={<div />}>
          <DeploymentTypeSelect type={selectedDeploymentType} onChange={updateDeploymentType} />
        </EuiDescribedFormGroup>
        {selectedDeploymentType === CLOUDBEAT_EKS && (
          <>
            <EuiSpacer size="m" />
            <EksForm inputs={newPolicy.inputs} onChange={updateEksVar} />
          </>
        )}
      </EuiForm>
    );
  }
);

CspCreatePolicyExtension.displayName = 'CspCreatePolicyExtension';

// eslint-disable-next-line import/no-default-export
export { CspCreatePolicyExtension as default };
