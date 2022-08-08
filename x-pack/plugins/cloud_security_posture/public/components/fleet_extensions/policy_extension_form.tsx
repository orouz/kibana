/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React, { memo } from 'react';
import { EuiForm } from '@elastic/eui';
import type {
  NewPackagePolicy,
  PackagePolicyCreateExtensionComponentProps,
  PackagePolicyEditExtensionComponentProps,
} from '@kbn/fleet-plugin/public';
import { CLOUDBEAT_EKS, CLOUDBEAT_VANILLA } from '../../../common/constants';
import { DeploymentTypeSelect, type InputType } from './deployment_type_select';
import { EksFormWrapper } from './eks_form';
import { getUpdatedStreamVars, isEksInput } from './utils';

type PolicyProps =
  | PackagePolicyEditExtensionComponentProps
  | PackagePolicyCreateExtensionComponentProps;

interface Props {
  type: 'edit' | 'create';
  newPolicy: PolicyProps['newPolicy'];
  onChange: PolicyProps['onChange'];
}

const getEnabledInputType = (inputs: NewPackagePolicy['inputs']): InputType =>
  (inputs.find((input) => input.enabled)?.type as InputType) || CLOUDBEAT_VANILLA;

const getUpdatedDeploymentType = (newPolicy: NewPackagePolicy, inputType: InputType) => ({
  isValid: true, // TODO: add validations
  updatedPolicy: {
    ...newPolicy,
    inputs: newPolicy.inputs.map((item) => ({
      ...item,
      enabled: item.type === inputType,
    })),
  },
});

const getUpdatedEksVar = (newPolicy: NewPackagePolicy, key: string, value: string) => ({
  isValid: true, // TODO: add validations
  updatedPolicy: {
    ...newPolicy,
    inputs: newPolicy.inputs.map((item) =>
      isEksInput(item) ? getUpdatedStreamVars(item, key, value) : item
    ),
  },
});

export const CspFleetPolicyExtensionForm = memo<Props>(({ newPolicy, type, onChange }) => {
  const selectedDeploymentType = getEnabledInputType(newPolicy.inputs);

  const updateDeploymentType = (inputType: InputType) =>
    onChange(getUpdatedDeploymentType(newPolicy, inputType));

  const updateEksVar = (key: string, value: string) =>
    onChange(getUpdatedEksVar(newPolicy, key, value));

  return (
    <EuiForm>
      <DeploymentTypeSelect
        type={selectedDeploymentType}
        onChange={updateDeploymentType}
        disabled={type === 'edit'}
      />
      {selectedDeploymentType === CLOUDBEAT_EKS && (
        <EksFormWrapper inputs={newPolicy.inputs} onChange={updateEksVar} />
      )}
    </EuiForm>
  );
});

CspFleetPolicyExtensionForm.displayName = 'CspFleetPolicyExtensionForm';
