/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';
import Listr, { type ListrTask } from 'listr';
import { writeFileAsync } from '..';

const ex = promisify(exec);

// TODO:
// - try 1 node script with formatjs/extract
// - fix eslint/ts errors
// - stats/metrics for bundle size, memory usage, build time, check for diffs

// - transform:
//  - fix eslint-dot-notation (i18n.common["Foo"])
//  - fix missing transform: import { i18n as t } from '@kbn/i18n';
//  - add import { i18n } from '@kbn/i18n and remove { FormattedMessage } from 'i18n/react-common'

// TODO: alternative ?
const ES_COMMON_LOCALE_PATH = resolve('packages/kbn-i18n/src/core/en-common.json');

function getCommonMessages(
  idMap: Map<string, [file: string, msg: { message: string }]>
): Array<[string, string[]]> {
  const msgs = [...idMap];
  const messageMap = new Map();

  for (const [, [file, msg]] of msgs) {
    const item = messageMap.get(msg.message) || new Set();
    item.add(file);
    messageMap.set(msg.message, item);
  }

  return (
    Array.from(messageMap)
      .map(([msg, files]) => [msg, [...files]] as [string, string[]])
      // TODO: sort is just for debug?
      .sort((a, b) => b[1].length - a[1].length)
  );
}

export function extractCommonDefaultMessages(): ListrTask[] {
  return [
    {
      title: 'Create en-common.json locale',
      task: (ctx) => {
        const allMessages = getCommonMessages(ctx.messages);
        const commonMessages = allMessages.filter(isCommonTranslation);
        ctx.commonMessages = commonMessages; // TODO: types
        return writeFileAsync(ES_COMMON_LOCALE_PATH, JSON.stringify(commonMessages));
        // TODO: need to build kbn18 afterwards
      },
    },
    {
      enabled: (ctx) => !!ctx.commonMessages && !!ctx.transformCommon,
      title: 'Transform to i18n.common',
      task: (ctx) => new Listr(ctx.commonMessages.map(createTransformTask)),
    },
    {
      enabled: (ctx) => !!ctx.commonMessages && !!ctx.transformCommon,
      title: 'run i18n_check --fix',
      // TODO: call script directly
      task: () => ex('node scripts/i18n_check --fix'),
    },
    {
      enabled: (ctx) => !!ctx.commonMessages && !!ctx.transformCommon,
      title: 'Prettify',
      task: (ctx) => {
        const fileList = [...new Set(ctx.commonMessages.flatMap(([, files]) => files))].join(' ');
        // TODO: use prettier module
        return ex(`node_modules/.bin/prettier --write ${fileList}`);
      },
    },
  ];
}

const createTransformTask = ([title, files]: [string, string[]], i: number) => ({
  title,
  task: () => transform(title, files, i),
});

// TODO: exclude {plural} and others
const isCommonTranslation = ([msg, files]: [string, string[]]) => files.length > 3;

// TODO: needed?
const quote = (v: string) => (v.includes("'") ? `"${v}"` : `'${v}'`);

// TODO: use babel, remove i18n_transform1
const transform = (msg: string, files: string[], idx: number) =>
  ex(`jscodeshift -t ${resolve('i18n_transform1.js')} ${files.join(' ')} --word=${quote(msg)}`);
