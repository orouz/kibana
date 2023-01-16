/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React, { memo, useEffect } from 'react';
import { EuiSpacer, EuiTitle } from '@elastic/eui';
import type {
  NewPackagePolicy,
  PackagePolicyCreateExtensionComponentProps,
} from '@kbn/fleet-plugin/public';
import { FormattedMessage } from '@kbn/i18n-react';
import { useParams } from 'react-router-dom';
import type { PostureInput, PosturePolicyTemplate } from '../../../common/types';
import { CLOUDBEAT_AWS, CLOUDBEAT_VANILLA } from '../../../common/constants';
import {
  getPosturePolicy,
  INPUTS_WITH_AWS_VARS,
  getEnabledPostureInput,
  type NewPackagePolicyPostureInput,
} from './utils';
import { AwsCredentialsForm, type AwsCredentialsType } from './aws_credentials_form';
import { PolicyInputSelector } from './policy_template_input_selector';
import { RadioGroup } from './csp_boxed_radio_group';

const DEFAULT_INPUT_TYPE = {
  kspm: CLOUDBEAT_VANILLA,
  cspm: CLOUDBEAT_AWS,
} as const;

const DEFAULT_AWS_VARS_GROUP: AwsCredentialsType = 'assume_role';

interface Props extends PackagePolicyCreateExtensionComponentProps {
  edit?: boolean;
}

interface PolicyVarsFormProps {
  newPolicy: NewPackagePolicy;
  input: NewPackagePolicyPostureInput;
  updatePolicy(updatedPolicy: NewPackagePolicy): void;
}

const PolicyVarsForm = ({ input, ...props }: PolicyVarsFormProps) => {
  switch (input.type) {
    case 'cloudbeat/cis_aws':
    case 'cloudbeat/cis_eks':
      return <AwsCredentialsForm {...props} input={input} />;
    default:
      return null;
  }
};

export const CspPolicyTemplateForm = memo<Props>(({ newPolicy, onChange, edit }) => {
  const { integration } = useParams<{ integration?: PosturePolicyTemplate }>();

  const input = getEnabledPostureInput(newPolicy);

  const updatePolicy = (updatedPolicy: NewPackagePolicy) =>
    onChange({
      isValid: true,
      updatedPolicy,
    });

  /**
   * - Updates policy inputs by user selection
   * - Updates hidden policy vars
   */
  const setEnabledPolicyInput = (inputType: PostureInput) =>
    updatePolicy(
      getPosturePolicy(
        newPolicy,
        inputType,
        INPUTS_WITH_AWS_VARS.includes(inputType)
          ? { 'aws.credentials.type': { value: DEFAULT_AWS_VARS_GROUP } }
          : undefined
      )
    );

  useEffect(() => {
    // Pick default input type for policy template.
    // Only 1 enabled input is supported when all inputs are initially enabled.
    if (!edit) setEnabledPolicyInput(DEFAULT_INPUT_TYPE[input.policy_template]);

    // Required for mount only to ensure a single input type is selected
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit]);

  return (
    <div>
      {!integration && (
        <PolicyTemplateSelector
          selectedTemplate={input.policy_template!}
          policy={newPolicy}
          setPolicyTemplate={(template) => setEnabledPolicyInput(DEFAULT_INPUT_TYPE[template])}
        />
      )}
      <PolicyInputSelector input={input} setInput={setEnabledPolicyInput} disabled={!!edit} />
      <PolicyVarsForm input={input} newPolicy={newPolicy} updatePolicy={updatePolicy} />
      <EuiSpacer />
    </div>
  );
});

const PolicyTemplateSelector = ({
  policy,
  selectedTemplate,
  setPolicyTemplate,
}: {
  selectedTemplate: PosturePolicyTemplate;
  policy: NewPackagePolicy;
  setPolicyTemplate(template: PosturePolicyTemplate): void;
}) => {
  const policyTemplates = new Set(policy.inputs.map((input) => input.policy_template!));

  return (
    <div>
      <EuiTitle size="xs">
        <h2>
          <FormattedMessage
            id="xpack.csp.fleetIntegration.selectIntegrationTypeTitle"
            defaultMessage="Select Integration Type"
          />
        </h2>
      </EuiTitle>
      <EuiSpacer />
      <RadioGroup
        options={Array.from(policyTemplates, (v) => ({ id: v, label: v.toUpperCase() }))}
        idSelected={selectedTemplate}
        onChange={(id) => setPolicyTemplate(id as PosturePolicyTemplate)}
      />
      <EuiSpacer size="xl" />
    </div>
  );
};
