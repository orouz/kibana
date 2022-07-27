/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiFormRow, EuiFieldText, EuiDescribedFormGroup, EuiLink, EuiText } from '@elastic/eui';
import { FormattedMessage } from '@kbn/i18n-react';
import type { NewPackagePolicyInput } from '@kbn/fleet-plugin/common';
import { i18n } from '@kbn/i18n';
import { CLOUDBEAT_EKS } from '../../../common/constants';

export const eksVars = [
  {
    id: 'access_key_id',
    label: i18n.translate(
      'xpack.csp.createPackagePolicy.eksIntegrationSettingsSection.accessKeyIdFieldLabel',
      { defaultMessage: 'Access key ID' }
    ),
  },
  {
    id: 'secret_access_key',
    label: i18n.translate(
      'xpack.csp.createPackagePolicy.eksIntegrationSettingsSection.secretAccessKeyFieldLabel',
      { defaultMessage: 'Secret access key' }
    ),
  },
  {
    id: 'session_token',
    label: i18n.translate(
      'xpack.csp.createPackagePolicy.eksIntegrationSettingsSection.sessionTokenFieldLabel',
      { defaultMessage: 'Session token' }
    ),
  },
] as const;

type EksVars = typeof eksVars;
type EksVarId = EksVars[number]['id'];
type EksFormVars = { [K in EksVarId]: string };

interface Props {
  onChange(field: EksVarId, value: string): void;
  inputs: NewPackagePolicyInput[];
}

const getEksVars = (input: NewPackagePolicyInput): EksFormVars => {
  const vars = input.streams?.[0].vars;
  return {
    access_key_id: vars?.access_key_id.value || '',
    secret_access_key: vars?.secret_access_key.value || '',
    session_token: vars?.session_token.value || '',
  };
};

export const isEksInput = (input: NewPackagePolicyInput) => input.type === CLOUDBEAT_EKS;

export const EksForm = ({ onChange, inputs }: Props) => {
  const values = getEksVars(inputs.find(isEksInput)!);

  const eksFormTitle = (
    <h4>
      <FormattedMessage
        id="xpack.csp.createPackagePolicy.eksIntegrationSettingsSection.awsCredentialsTitle"
        defaultMessage="AWS Credentials"
      />
    </h4>
  );

  const eksFormDescription = (
    <>
      <FormattedMessage
        id="xpack.csp.createPackagePolicy.eksIntegrationSettingsSection.awsCredentialsDescription"
        defaultMessage="In order to run some of the rules in the benchmark, we need elevated access. You can follow {link} to generate the necessary credentials."
        values={{
          // TODO: add link
          link: (
            <EuiLink href="#">
              <FormattedMessage
                id="xpack.csp.createPackagePolicy.eksIntegrationSettingsSection.awsCredentialsInstructionsLink"
                defaultMessage="these instructions"
              />
            </EuiLink>
          ),
        }}
      />
      <br />
      <br />
      <FormattedMessage
        id="xpack.csp.createPackagePolicy.eksIntegrationSettingsSection.awsCredentialsNote"
        defaultMessage="If you choose not to provide credentials, only a subset of the benchmark rules will be evaluated against your cluster(s)."
      />
    </>
  );

  return (
    <EuiDescribedFormGroup title={eksFormTitle} description={eksFormDescription}>
      {eksVars.map((field) => (
        <EuiFormRow
          key={field.id}
          label={field.label}
          labelAppend={
            <EuiText size="xs" color="subdued">
              <FormattedMessage
                id="xpack.csp.createPackagePolicy.eksIntegrationSettingsSection.optionalField"
                defaultMessage="Optional"
              />
            </EuiText>
          }
        >
          <EuiFieldText
            value={values[field.id]}
            onChange={(event) => onChange(field.id, event.target.value)}
          />
        </EuiFormRow>
      ))}
    </EuiDescribedFormGroup>
  );
};
