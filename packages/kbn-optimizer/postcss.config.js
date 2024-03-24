/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const preset = require('cssnano-preset-default');
const { toDisplayP3ColorPostcss } = require('@kbn/css-plugins');

module.exports = {
  plugins: [
    autoprefixer(),
    toDisplayP3ColorPostcss(),
    cssnano({
      preset: preset({ discardComments: false }),
    }),
  ],
};
