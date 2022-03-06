/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import chalk from 'chalk';
import Listr from 'listr';
import { resolve } from 'path';

import { createFailError, run } from '@kbn/dev-utils';
import { ErrorReporter, serializeToJson, serializeToJson5, writeFileAsync } from './i18n';
import { extractDefaultMessages, mergeConfigs } from './i18n/tasks';
import { extractCommonDefaultMessages } from './i18n/tasks/extract_common_translations';

run(
  async ({
    flags: {
      path,
      'output-dir': outputDir,
      'output-format': outputFormat,
      'include-config': includeConfig,
      'common-count': commonLocale,
      transform: transformCommon,
    },
    log,
  }) => {
    if (!outputDir || typeof outputDir !== 'string') {
      throw createFailError(
        `${chalk.white.bgRed(' I18N ERROR ')} --output-dir option should be specified.`
      );
    }

    if (typeof path === 'boolean' || typeof includeConfig === 'boolean') {
      throw createFailError(
        `${chalk.white.bgRed(' I18N ERROR ')} --path and --include-config require a value`
      );
    }
    const srcPaths = Array().concat(path || ['./src', './packages', './x-pack']);

    const list = new Listr([
      {
        title: 'Merging .i18nrc.json files',
        task: () => new Listr(mergeConfigs(includeConfig), { exitOnError: true }),
      },
      {
        title: 'Extracting Default Messages',
        task: ({ config }) =>
          new Listr(extractDefaultMessages(config, srcPaths), {
            exitOnError: true,
            renderer: 'silent',
          }),
      },
      {
        title: 'Writing to file',
        enabled: (ctx) => outputDir && ctx.messages.size,
        task: async (ctx) => {
          const msgs: Array<[string, { message: string }]> = [...ctx.messages].map(
            ([id, [, msg]]) => [id, msg]
          );
          const sortedMessages = msgs.sort(([key1], [key2]) => key1.localeCompare(key2));
          await writeFileAsync(
            resolve(outputDir, 'en.json'),
            outputFormat === 'json5'
              ? serializeToJson5(sortedMessages)
              : serializeToJson(sortedMessages)
          );
        },
      },
      {
        enabled: () => !!commonLocale,
        title: 'Extract common translations',
        task: () =>
          // @ts-ignore
          new Listr(extractCommonDefaultMessages(outputDir), {
            exitOnError: true,
          }),
      },
    ]);

    try {
      const reporter = new ErrorReporter();
      const messages: Map<string, [file: string, msg: { message: string }]> = new Map();

      await list.run({ messages, reporter, transformCommon });
    } catch (error) {
      process.exitCode = 1;
      if (error instanceof ErrorReporter) {
        error.errors.forEach((e: string | Error) => log.error(e));
      } else {
        log.error('Unhandled exception!');
        log.error(error);
      }
    }
    process.exit();
  },
  {
    flags: {
      allowUnexpected: true,
      guessTypesForUnexpectedFlags: true,
    },
  }
);
