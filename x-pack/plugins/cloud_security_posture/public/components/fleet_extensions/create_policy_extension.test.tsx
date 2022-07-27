/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import type { NewPackagePolicy } from '@kbn/fleet-plugin/public';
import { CspCreatePolicyExtension, CSP_CREATE_POLICY_FORM } from './create_policy_extension';
import { eksVars } from './eks_form';
import Chance from 'chance';
import { CLOUDBEAT_EKS } from '../../../common/constants';
import { NewPackagePolicyInput } from '@kbn/fleet-plugin/common';

const chance = new Chance();

const defaultNewPolicy: NewPackagePolicy = {
  name: 'some-cloud_security_posture-policy',
  description: '',
  namespace: 'default',
  policy_id: '',
  enabled: true,
  output_id: '',
  inputs: [
    {
      type: 'cloudbeat/vanilla',
      policy_template: 'kspm',
      enabled: true,
      streams: [
        {
          enabled: true,
          data_stream: {
            type: 'logs',
            dataset: 'cloud_security_posture.findings',
          },
        },
      ],
    },
    {
      type: 'cloudbeat/eks',
      policy_template: 'kspm',
      enabled: false,
      streams: [
        {
          enabled: false,
          data_stream: {
            type: 'logs',
            dataset: 'cloud_security_posture.findings',
          },
          vars: {
            access_key_id: {
              type: 'text',
            },
            secret_access_key: {
              type: 'text',
            },
            session_token: {
              type: 'text',
            },
          },
        },
      ],
    },
  ],
  package: {
    name: 'cloud_security_posture',
    title: 'Kubernetes Security Posture Management',
    version: '0.0.21',
  },
  vars: {
    dataYaml: {
      type: 'yaml',
    },
  },
};

const enableEksInput = (input: NewPackagePolicyInput) => ({
  ...input,
  enabled: input.type === CLOUDBEAT_EKS,
});

describe('<CspCreatePolicyExtension />', () => {
  const onChange = jest.fn();
  const WrappedComponent = ({ newPolicy = defaultNewPolicy }) => {
    return <CspCreatePolicyExtension newPolicy={newPolicy} onChange={onChange} />;
  };

  beforeEach(() => {
    onChange.mockClear();
  });

  it('renders <DeploymentTypeSelect/>', async () => {
    const { getByLabelText, getByTestId } = render(<WrappedComponent />);

    expect(getByTestId(CSP_CREATE_POLICY_FORM)).toBeInTheDocument();
    expect(getByLabelText('Kubernetes Deployment')).toBeInTheDocument();
  });

  it('renders <EksForm/>', async () => {
    const eksPolicy = { ...defaultNewPolicy };
    eksPolicy.inputs = eksPolicy.inputs.map(enableEksInput);

    const { getByLabelText } = render(<WrappedComponent newPolicy={eksPolicy} />);

    eksVars.forEach((eksVar) => {
      expect(getByLabelText(eksVar.label)).toBeInTheDocument();
    });
  });

  // TODO: fix testing a combo box selection
  it.skip('handles updating deployment type', async () => {
    const { getByLabelText, getByTestId } = render(<WrappedComponent />);

    // eksVars.forEach((eksVar) => {
    //   expect(getByLabelText(eksVar.label)).not.toBeInTheDocument();
    // });

    const input = getByLabelText('Kubernetes Deployment') as HTMLInputElement;
    fireEvent.click(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');

    const eksOption = getByTestId('cloudbeat_eks_option');
    // fireEvent.change(input, { target: { value: 'EKS (Elastic Kubernetes Service)' } });
    // fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });
    expect(eksOption).toBeInTheDocument();

    fireEvent.click(eksOption);
    // expect(input.getAttribute('aria-expanded')).toBe('false');
    // expect(input.getAttribute('value')).toBe('cloudbeat/eks');
    // eksVars.forEach((eksVar) => {
    //   expect(getByLabelText(eksVar.label)).toBeInTheDocument();
    // });
  });

  it('handles updating eks form', async () => {
    const eksPolicy = { ...defaultNewPolicy };
    eksPolicy.inputs = eksPolicy.inputs.map(enableEksInput);

    const { getByLabelText } = render(<WrappedComponent newPolicy={eksPolicy} />);
    const randomValues = chance.unique(chance.string, 3);

    eksVars.forEach((eksVar, i) => {
      const elm = getByLabelText(eksVar.label) as HTMLInputElement;
      fireEvent.change(elm, { target: { value: randomValues[i] } });
      const updatedPolicy = { ...eksPolicy };
      updatedPolicy.inputs[1].streams[0].vars![eksVar.id].value = randomValues[i];
      expect(onChange).toBeCalledWith({
        isValid: true,
        updatedPolicy,
      });
    });
  });
});
