/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { memo } from 'react';
import { EuiFlexGroup, EuiFlexItem, EuiForm, EuiSpacer } from '@elastic/eui';
import type { PackagePolicyCreateExtensionComponentProps } from '@kbn/fleet-plugin/public';
import type { NewPackagePolicyInput, NewPackagePolicyInputStream } from '@kbn/fleet-plugin/common';
import { CLOUDBEAT_EKS } from '../../../common/constants';
import { DeploymentTypeSelect, getEnabledInputType, InputType } from './deployment_type_select';
import { EksForm, isEksInput } from './eks_form';

export const CSP_CREATE_POLICY_FORM = 'csp_create_policy_form';

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

    console.log({ newPolicy });
    const updatePolicyInput = (updater: (input: NewPackagePolicyInput) => NewPackagePolicyInput) =>
      onChange({
        isValid: true, // TODO: add validations
        updatedPolicy: {
          ...newPolicy,
          inputs: newPolicy.inputs.map(updater),
        },
      });

    /**
     * Ensures a single enabled input
     */
    const updateDeploymentType = (inputType: InputType) =>
      updatePolicyInput((item) => ({ ...item, enabled: item.type === inputType }));

    /**
     * Updates the first EKS input data-stream vars object
     */
    const updateEksVar = (varKey: string, varValue: string) => {
      updatePolicyInput((item) =>
        isEksInput(item)
          ? { ...item, streams: [getUpdatedStreamVars(item.streams[0], varKey, varValue)] }
          : item
      );
    };

    return (
      <EuiForm style={{ paddingBottom: 40 }} data-test-subj={CSP_CREATE_POLICY_FORM}>
        <EuiFlexGroup>
          <EuiFlexItem grow={1}>&nbsp;</EuiFlexItem>
          <EuiFlexItem grow={1}>
            <DeploymentTypeSelect type={selectedDeploymentType} onChange={updateDeploymentType} />
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiSpacer size="xl" />
        {selectedDeploymentType === CLOUDBEAT_EKS && (
          <EuiFlexGroup>
            <EuiFlexItem>
              <EksForm inputs={newPolicy.inputs} onChange={updateEksVar} />
            </EuiFlexItem>
          </EuiFlexGroup>
        )}
      </EuiForm>
    );
  }
);

CspCreatePolicyExtension.displayName = 'CspCreatePolicyExtension';

// eslint-disable-next-line import/no-default-export
export { CspCreatePolicyExtension as default };
