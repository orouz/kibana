/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React from 'react';
import {
  EuiFieldText,
  EuiFieldPassword,
  EuiFormRow,
  EuiLink,
  EuiSpacer,
  EuiText,
} from '@elastic/eui';
import type { NewPackagePolicy } from '@kbn/fleet-plugin/public';
import { NewPackagePolicyInput } from '@kbn/fleet-plugin/common';
import { FormattedMessage } from '@kbn/i18n-react';
import { i18n } from '@kbn/i18n';
import { InlineRadioGroup } from './inline_radio_group';
import { getPolicyWithInputVars, NewPackagePolicyPostureInput } from './utils';

const DocsLink = (
  <EuiText color={'subdued'} size="s">
    <FormattedMessage
      id="xpack.csp.awsIntegration.docsLink"
      defaultMessage="Read the {docs} for more details"
      values={{
        docs: (
          <EuiLink
            href="https://docs.aws.amazon.com/general/latest/gr/aws-sec-cred-types.html"
            external
          >
            documentation
          </EuiLink>
        ),
      }}
    />
  </EuiText>
);

const AssumeRoleDescription = (
  <div>
    <EuiText color={'subdued'} size="s">
      <FormattedMessage
        id="xpack.csp.awsIntegration.assumeRoleDescription"
        defaultMessage="An IAM role Amazon Resource Name (ARN) is an IAM identity that you can create in your AWS
      account. When creating an IAM role, users can define the role’s permissions. Roles do not have
      standard long-term credentials such as passwords or access keys."
      />
    </EuiText>
    <EuiSpacer />
  </div>
);

const DirectAccessKeysDescription = (
  <div>
    <EuiText color={'subdued'} size="s">
      <FormattedMessage
        id="xpack.csp.awsIntegration.directAccessKeysDescription"
        defaultMessage="Access keys are long-term credentials for an IAM user or the AWS account root user."
      />
    </EuiText>
    <EuiSpacer />
  </div>
);

const TemporaryKeysDescription = (
  <div>
    <EuiText color={'subdued'} size="s">
      <FormattedMessage
        id="xpack.csp.awsIntegration.temporaryKeysDescription"
        defaultMessage="You can configure temporary security credentials in AWS to last for a specified duration. They
      consist of an access key ID, a secret access key, and a security token, which is typically
      found using GetSessionToken."
      />
    </EuiText>
    <EuiSpacer />
  </div>
);

const SharedCredentialsDescription = (
  <div>
    <EuiText color={'subdued'} size="s">
      <FormattedMessage
        id="xpack.csp.awsIntegration.sharedCredentialsDescription"
        defaultMessage="If you use different AWS credentials for different tools or applications, you can use profiles
      to define multiple access keys in the same configuration file."
      />
    </EuiText>
    <EuiSpacer />
  </div>
);

const AWS_FIELD_LABEL = {
  access_key_id: i18n.translate('xpack.csp.awsIntegration.accessKeyIdLabel', {
    defaultMessage: 'Access Key ID',
  }),
  secret_access_key: i18n.translate('xpack.csp.awsIntegration.secretAccessKeyLabel', {
    defaultMessage: 'Secret Access Key',
  }),
};

type AwsOptions = Record<
  string,
  {
    label: string;
    info: React.ReactNode;
    fields: Record<string, { label: string; type?: 'password' | 'text' }>;
  }
>;

// Ensures the options object is typed correctly
// Will be removed in TS 4.9 when the 'satisfies' keyword is added
const satisfies =
  <T extends unknown>() =>
  <U extends T>(value: U) =>
    value;

const options = satisfies<AwsOptions>()({
  assume_role: {
    label: i18n.translate('xpack.csp.awsIntegration.assumeRoleLabel', {
      defaultMessage: 'Assume role',
    }),
    info: AssumeRoleDescription,
    fields: {
      role_arn: {
        label: i18n.translate('xpack.csp.awsIntegration.roleArnLabel', {
          defaultMessage: 'Role ARN',
        }),
      },
    },
  },
  direct_access_key: {
    label: i18n.translate('xpack.csp.awsIntegration.directAccessKeyLabel', {
      defaultMessage: 'Direct access keys',
    }),
    info: DirectAccessKeysDescription,
    fields: {
      access_key_id: { label: AWS_FIELD_LABEL.access_key_id },
      secret_access_key: { label: AWS_FIELD_LABEL.secret_access_key, type: 'password' },
    },
  },
  temporary_keys: {
    info: TemporaryKeysDescription,
    label: i18n.translate('xpack.csp.awsIntegration.temporaryKeysLabel', {
      defaultMessage: 'Temporary keys',
    }),
    fields: {
      access_key_id: { label: AWS_FIELD_LABEL.access_key_id },
      secret_access_key: { label: AWS_FIELD_LABEL.secret_access_key, type: 'password' },
      session_token: {
        label: i18n.translate('xpack.csp.awsIntegration.sessionTokenLabel', {
          defaultMessage: 'Session Token',
        }),
      },
    },
  },
  shared_credentials: {
    label: i18n.translate('xpack.csp.awsIntegration.sharedCredentialLabel', {
      defaultMessage: 'Shared credentials',
    }),
    info: SharedCredentialsDescription,
    fields: {
      shared_credential_file: {
        label: i18n.translate('xpack.csp.awsIntegration.sharedCredentialFileLabel', {
          defaultMessage: 'Shared Credential File',
        }),
      },
      credential_profile_name: {
        label: i18n.translate('xpack.csp.awsIntegration.credentialProfileNameLabel', {
          defaultMessage: 'Credential Profile Name',
        }),
      },
    },
  },
} as const);

type AwsCredentialsType = keyof typeof options;
const DEFAULT_AWS_VARS_TYPE: AwsCredentialsType = 'assume_role';
const AWS_CREDENTIALS_OPTIONS = Object.keys(options).map((value) => ({
  id: value as AwsCredentialsType,
  label: options[value as keyof typeof options].label,
}));

interface Props {
  newPolicy: NewPackagePolicy;
  input: NewPackagePolicyPostureInput;
  updatePolicy(updatedPolicy: NewPackagePolicy): void;
}

const getInputVarsFields = (
  input: NewPackagePolicyInput,
  fields: AwsOptions[keyof AwsOptions]['fields']
) =>
  Object.entries(input.streams[0].vars || {})
    .filter(([id]) => id in fields)
    .map(([id, inputVar]) => {
      const field = fields[id];
      return {
        id,
        label: field.label,
        type: field.type || 'text',
        value: inputVar.value,
      } as const;
    });

const getDefaultAwsType = (input: Props['input']): AwsCredentialsType =>
  input?.streams[0]?.vars?.['aws.credentials.type']?.value || DEFAULT_AWS_VARS_TYPE;

export const AwsCredentialsForm = ({ input, newPolicy, updatePolicy }: Props) => {
  const awsCredentialsType = getDefaultAwsType(input);
  const group = options[awsCredentialsType];
  const fields = getInputVarsFields(input, group.fields);

  return (
    <>
      <EuiSpacer size="l" />
      <AwsCredentialTypeSelector
        type={awsCredentialsType}
        onChange={(optionId) => {
          let policy = getPolicyWithInputVars(newPolicy, 'aws.credentials.type', optionId);

          // reset all form group values when changing group
          fields.forEach((field) => {
            policy = getPolicyWithInputVars(policy, field.id, '');
          });

          updatePolicy(policy);
        }}
      />
      <EuiSpacer size="m" />
      {group.info}
      {DocsLink}
      <EuiSpacer />
      <AwsInputVarFields
        onChange={(key, value) => updatePolicy(getPolicyWithInputVars(newPolicy, key, value))}
        fields={fields}
      />
      <EuiSpacer />
    </>
  );
};

const AwsCredentialTypeSelector = ({
  type,
  onChange,
}: {
  onChange(type: AwsCredentialsType): void;
  type: AwsCredentialsType;
}) => (
  <InlineRadioGroup
    size="s"
    options={[...AWS_CREDENTIALS_OPTIONS]}
    idSelected={type}
    onChange={(id) => onChange(id as AwsCredentialsType)}
  />
);
const AwsInputVarFields = ({
  fields,
  onChange,
}: {
  fields: Array<AwsOptions[keyof AwsOptions]['fields'][number] & { value: string; id: string }>;
  onChange: (key: string, value: string) => void;
}) => (
  <div>
    {fields.map((field) => (
      <EuiFormRow key={field.id} label={field.label} fullWidth>
        <>
          {field.type === 'password' && (
            <EuiFieldPassword
              type="dual"
              fullWidth
              value={field.value || ''}
              onChange={(event) => onChange(field.id, event.target.value)}
            />
          )}
          {field.type === 'text' && (
            <EuiFieldText
              fullWidth
              value={field.value || ''}
              onChange={(event) => onChange(field.id, event.target.value)}
            />
          )}
        </>
      </EuiFormRow>
    ))}
  </div>
);
