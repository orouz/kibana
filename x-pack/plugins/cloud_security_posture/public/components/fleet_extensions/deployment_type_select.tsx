/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiComboBox,
  EuiToolTip,
  EuiFormRow,
  EuiIcon,
  type EuiComboBoxOptionOption,
} from '@elastic/eui';
import { FormattedMessage } from '@kbn/i18n-react';
import { i18n } from '@kbn/i18n';
import { NewPackagePolicy } from '@kbn/fleet-plugin/common';
import { CIS_INTEGRATION_INPUTS_MAP, CLOUDBEAT_VANILLA } from '../../../common/constants';

export type InputType = keyof typeof CIS_INTEGRATION_INPUTS_MAP;

interface Props {
  type: InputType;
  /**
   * Input will be disabled when onChange is undefined
   */
  onChange?: (type: InputType) => void;
}

const kubeDeployOptions: Array<EuiComboBoxOptionOption<InputType>> = [
  {
    'data-test-subj': 'cloudbeat_vanilla_option',
    value: 'cloudbeat/vanilla',
    label: i18n.translate(
      'xpack.csp.createPackagePolicy.stepConfigure.integrationSettingsSection.vanillaKubernetesDeploymentOption',
      { defaultMessage: 'Unmanaged Kubernetes' }
    ),
  },
  {
    'data-test-subj': 'cloudbeat_eks_option',
    value: 'cloudbeat/eks',
    label: i18n.translate(
      'xpack.csp.createPackagePolicy.stepConfigure.integrationSettingsSection.eksKubernetesDeploymentOption',
      { defaultMessage: 'EKS (Elastic Kubernetes Service)' }
    ),
  },
];

// TODO: this breaks in responsive,, ends up in a column not a row with aligned with text
const KubernetesDeploymentFieldLabel = () => (
  <EuiToolTip
    content={
      <FormattedMessage
        id="xpack.csp.createPackagePolicy.stepConfigure.integrationSettingsSection.kubernetesDeploymentLabelTooltip"
        defaultMessage="Select your Kubernetes deployment type"
      />
    }
  >
    <EuiFlexGroup gutterSize="xs" alignItems="center">
      <EuiFlexItem grow={2} style={{ whiteSpace: 'nowrap' }}>
        <FormattedMessage
          id="xpack.csp.createPackagePolicy.stepConfigure.integrationSettingsSection.kubernetesDeploymentLabel"
          defaultMessage="Kubernetes Deployment"
        />
      </EuiFlexItem>
      <EuiFlexItem grow={1}>
        <EuiIcon size="m" color="subdued" type="questionInCircle" />
      </EuiFlexItem>
    </EuiFlexGroup>
  </EuiToolTip>
);

export const getEnabledInputType = (inputs: NewPackagePolicy['inputs']): InputType =>
  (inputs.find((input) => input.enabled)?.type as InputType) || CLOUDBEAT_VANILLA;

export const DeploymentTypeSelect = ({ type, onChange }: Props) => (
  <EuiFormRow label={<KubernetesDeploymentFieldLabel />}>
    <EuiComboBox
      singleSelection={{ asPlainText: true }}
      options={kubeDeployOptions}
      selectedOptions={kubeDeployOptions.filter((o) => o.value === type)}
      isDisabled={!onChange}
      onChange={(options) => onChange?.(options[0].value!)}
    />
  </EuiFormRow>
);
