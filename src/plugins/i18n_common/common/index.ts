/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import enCommonTranslation from '../translations/en.json';
export const PLUGIN_ID = 'i18nCommon';
export const PLUGIN_NAME = 'i18n_common';
// eslint-disable-next-line import/order
import { i18n } from '@kbn/i18n';

export const getCommonMessage = (id: keyof typeof enCommonTranslation['messages']) =>
  i18n.translate(id, {} as any);
//   enCommonTranslation.messages[id];
