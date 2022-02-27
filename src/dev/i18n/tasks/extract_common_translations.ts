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
        ctx.commonMessages = commonMessages; // TODO: ???
        // TODO: write to kbn-i18n/en-common.json
        // return writeFileAsync('foo.json', JSON.stringify(commonMessages));
        // TODO: need to build kbn18 afterwards
      },
    },
    {
      enabled: (ctx) => !!ctx.commonMessages && !!ctx.transformCommon,
      title: 'Transform to i18n.common',
      task: (ctx) => new Listr(ctx.commonMessages.map(createTransformTask)),
    },
    // {
    //   enabled: (ctx) => !!ctx.commonMessages && !!ctx.transformCommon,
    //   title: 'run i18n_check --fix',
    //   task: () => ex('node scripts/i18n_check --fix'),
    // },
    // {
    //   enabled: (ctx) => !!ctx.commonMessages && !!ctx.transformCommon,
    //   title: 'Prettify',
    //   task: (ctx) => {
    //     const fileList = [...new Set(ctx.commonMessages.flatMap(([, files]) => files))].join(' ');
    //     return ex(`node_modules/.bin/prettier --write ${fileList}`);
    //   },
    // },
  ];
}

const createTransformTask = ([msg, files]: [string, string[]], i: number) => ({
  // title: `\n message: \t ${msg} \n files: \t ${files.length} `,
  title: msg,
  task: () => transform(msg, files, i),
});

// TODO: exclude {plural} and others
const isCommonTranslation = ([msg, files]: [string, string[]]) => files.length > 3;

// TODO: needed?
const quote = (v: string) => (v.includes("'") ? `"${v}"` : `'${v}'`);

const transform = (msg: string, files: string[], idx: number) =>
  // TODO: replace jscodeshift ?
  ex(`jscodeshift -t ${resolve('i18n_transform1.js')} ${files.join(' ')} --word=${quote(msg)}`);
