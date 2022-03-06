/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

export const parser = 'tsx';

function camelize(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '');
}

const hasValuesProperty = (attrs) => attrs.some((a) => a.name.name === 'values');

const isAttributesMatch = (attrs, word) =>
  attrs.some((a) => a.name.name === 'defaultMessage' && a.value.value === word);

/**
 * @param {{word: string}} opts
 */
export default function transform(file, api, opts) {
  const j = api.jscodeshift;
  const root = j(file.source);

  // const exp1 = j.memberExpression(
  //   j.memberExpression(j.identifier('i18n'), j.identifier('common')),
  //   j.stringLiteral(opts.word),
  //   true
  // );

  const exp = j.callExpression(j.memberExpression(j.identifier('i18n'), j.identifier('common')), [
    j.stringLiteral(camelize(opts.word)),
  ]);

  root
    .find(j.JSXElement, {
      openingElement: {
        name: { name: 'FormattedMessage' },
      },
    })
    .replaceWith((p) => {
      if (
        hasValuesProperty(p.value.openingElement.attributes) ||
        !isAttributesMatch(p.value.openingElement.attributes, opts.word)
      )
        return p.value;

      if (Array.isArray(p.parentPath.value))
        return p.parentPath.name === 'children' ? j.jsxExpressionContainer(exp) : exp;

      if (
        j.ArrowFunctionExpression.check(p.parentPath.value) ||
        j.ReturnStatement.check(p.parentPath.value)
      )
        return exp;

      return p.value;
    });

  root
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: { name: 'i18n' },
        property: { name: 'translate' },
      },
    })
    .replaceWith((p) => {
      if (
        p.value.arguments.some(
          (a) =>
            j.ObjectExpression.check(a) &&
            a.properties.some((p) => p.key.name === 'defaultMessage' && p.value.value === opts.word)
        )
      )
        return exp;

      return p.value;
    });

  return root.toSource();
}
