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
import fs from 'fs/promises';
// @ts-expect-error
import { isI18nTranslateFunction } from '../utils/utils';
// @ts-expect-error
import { isIntlFormatMessageFunction, isFormattedMessageElement } from '../extractors/code';
/** 
  runtime discovery 
  - if dependenecy
  - call addTranslation, or
  - make it auto-discoverable 

  static discovery 

  x-pack/plugins/translations
 */

// Option1:
// i18n.common('cancel')
// <CommonMessage id='cancel'/>

const ex = promisify(exec);

function camelize(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '');
}
// TODO:
// - transform:
//  - fix eslint-dot-notation (i18n.common["Foo"])
//    - i18n.smth['common.Foo'] (allowPattern)
//    - patch plugin locally
//  - fix missing transform: import { i18n as t } from '@kbn/i18n';
//  - add import { i18n } from '@kbn/i18n and remove { FormattedMessage } from 'i18n/react-common'
// - stats/metrics for bundle size, memory usage, build time, check for diffs
// - add JP/CP translations

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

const i18nCommonPath = resolve('src/plugins/i18n_common/translations');

const createTranslation = (msgs: Array<[string, string[]]>) => ({
  locale: 'en',
  messages: Object.fromEntries(msgs.map(([msg]) => [camelize(msg), msg])),
});

export function extractCommonDefaultMessages(outputDir: string): ListrTask[] {
  return [
    {
      title: 'Create en-common.json locale',
      task: (ctx) => {
        const allMessages = getCommonMessages(ctx.messages);
        const commonMessages = allMessages.filter(isCommonTranslation);
        ctx.commonMessages = commonMessages; // TODO: types

        return fs
          .mkdir(i18nCommonPath, { recursive: true })
          .then(() =>
            fs.writeFile(
              `${i18nCommonPath}/en.json`,
              JSON.stringify(createTranslation(commonMessages))
            )
          );
        // TODO: need to build kbn18 afterwards
      },
    },
    // {
    //   enabled: (ctx) => !!ctx.commonMessages && !!ctx.transformCommon,
    //   title: 'Transform to i18n.common',
    //   task: (ctx) => new Listr(ctx.commonMessages.map(createTransformTask)),
    // },
    // {
    //   enabled: (ctx) => !!ctx.commonMessages && !!ctx.transformCommon,
    //   title: 'run i18n_check --fix',
    //   // TODO: call script directly
    //   task: () => ex('node scripts/i18n_check --fix'),
    // },
    // {
    //   enabled: (ctx) => !!ctx.commonMessages && !!ctx.transformCommon,
    //   title: 'Prettify',
    //   task: (ctx) => {
    //     const fileList = [
    //       ...new Set(ctx.commonMessages.flatMap(([, files]: [unknown, string[]]) => files)),
    //     ].join(' ');
    //     // TODO: use api
    //     return ex(`node_modules/.bin/prettier --write ${fileList}`);
    //   },
    // },
    // {
    // title: 'Add JP/CN back?'
    // get all keys for a word
    // get all their values from JP/CN
    // get the highest ranking one and set it at JP.common.Word
    // }
  ];
}
const quote = (str: string) => (str.includes("'") ? `"${str}"` : `'${str}'`);

const transformPath = resolve('i18n_codeshift_transform.js');

const isCommonTranslation = ([msg, files]: [string, string[]]) =>
  !/({|})/g.test(msg) && files.length >= 3;

const createTransformTask = ([title, files]: [string, string[]], i: number) => ({
  title,
  task: () => ex(`jscodeshift -t ${transformPath} ${files.join(' ')} --word=${quote(title)}`),
});
