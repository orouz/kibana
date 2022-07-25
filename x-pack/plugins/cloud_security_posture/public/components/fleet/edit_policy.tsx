/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import {
  EuiPanel,
  EuiText,
  EuiTitle,
  EuiLoadingChart,
  EuiFlexGroup,
  EuiFlexItem,
  EuiComboBox,
  EuiSelect,
  EuiForm,
  EuiFormRow,
  EuiFieldText,
} from '@elastic/eui';

export const EditPolicy = (props) => {
  console.log({ props });

  return (
    <EuiForm style={{ paddingBottom: 40 }}>
      <EuiFlexGroup>
        <EuiFlexItem style={{ justifyContent: 'center' }}>
          <EuiText size="m" style={{ fontWeight: 'bold' }}>
            Integration Type
          </EuiText>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiSelect
            disabled={true}
            placeholder="Select a single option"
            options={[{ text: 'CIS K8S Vanilla' }, { text: 'CIS EKS' }]}
            onChange={(e) => {
              const val = e.target.value;
              const id = idmap[val as keyof typeof idmap];
              props.onChange({
                isValid: true,
                updatedPolicy: props.newPolicy.inputs.map((item) => {
                  return { ...item, enabled: item.type === id };
                }),
              });
            }}
          />
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiForm>
  );
};
const idmap = {
  'CIS K8S Vanilla': 'cloudbeat/vanilla',
  'CIS EKS': 'cloudbeat/eks',
} as const;

// eslint-disable-next-line import/no-default-export
export { EditPolicy as default };
