/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { useEuiTheme, EuiRadioGroup, type EuiRadioGroupProps } from '@elastic/eui';
import { css } from '@emotion/react';

type RadioGroupProps = Pick<EuiRadioGroupProps, 'onChange' | 'options' | 'idSelected'>;

type Props = RadioGroupProps & {
  size?: 's' | 'm';
};

export const InlineRadioGroup = ({ idSelected, size, options, onChange }: Props) => {
  const { euiTheme } = useEuiTheme();

  return (
    <EuiRadioGroup
      idSelected={idSelected}
      options={options.map((o) => ({
        id: o.id,
        label: o.label,
        disabled: o.disabled,
        ['data-enabled']: idSelected === o.id,
        ['data-disabled']: o.disabled,
        className: '__extendedRadio',
      }))}
      onChange={onChange}
      css={css`
        display: grid;
        grid-template-columns: repeat(${options.length}, 1fr);
        grid-template-rows: ${size === 's' ? euiTheme.size.xxl : euiTheme.size.xxxl};
        column-gap: ${euiTheme.size.s};
        align-items: center;

        > .__extendedRadio {
          margin-top: 0;
          height: 100%;
          padding-left: ${euiTheme.size.s};
          padding-right: ${euiTheme.size.s};

          display: grid;
          grid-template-columns: auto 1fr;
          column-gap: ${euiTheme.size.s};
          align-items: center;

          border: 1px solid ${euiTheme.colors.lightShade};
          border-radius: ${euiTheme.border.radius.medium};
          background: ${euiTheme.colors.emptyShade};

          &[data-enabled='true'] {
            border-color: ${euiTheme.colors.primary};
            background: ${euiTheme.colors.lightestShade};
          }

          &[data-disabled='true'] {
            border-color: ${euiTheme.colors.disabled};
            background: ${euiTheme.colors.emptyShade};
          }

          &.__extendedRadio {
            & > *:not(label):not(input) {
              position: inherit;
              top: 0;
              left: 0;
            }

            & > label {
              padding-left: 0;
            }
          }
        }
      `}
    />
  );
};
