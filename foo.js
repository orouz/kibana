/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

const { transformSync } = require('@babel/core');
const t = require('@babel/types');
// const fs = require('fs');

function getImports(root) {
  let node = root;
  while (node.parentPath) {
    node = node.parentPath;
  }
  const imports = node.node.body.filter(t.isImportDeclaration);
  console.log({ imports: imports[0].specifiers[0] });
  return imports;
}
function isMissingingI18nImport(node) {}

function isI18nTranslateFunctionWithCommon(node, str) {
  return (
    t.isCallExpression(node) &&
    (t.isIdentifier(node.callee, { name: 'i18n' }) ||
      (t.isMemberExpression(node.callee) &&
        t.isIdentifier(node.callee.object, { name: 'i18n' }) &&
        t.isIdentifier(node.callee.property, { name: 'translate' }))) &&
    node.arguments.some(
      (v) =>
        t.isObjectExpression(v) &&
        v.properties.some(
          (p) =>
            t.isIdentifier(p.key, { name: 'defaultMessage' }) &&
            t.isStringLiteral(p.value, { value: str })
        )
    )
  );
}

function isFormattedMessageWithCommon(node, str) {
  return (
    t.isJSXElement(node) &&
    t.isJSXOpeningElement(node.openingElement) &&
    t.isJSXIdentifier(node.openingElement.name, { name: 'FormattedMessage' }) &&
    node.openingElement.attributes.some(
      (v) =>
        t.isJSXIdentifier(v.name, { name: 'defaultMessage' }) &&
        t.isStringLiteral(v.value, { value: str })
    )
  );
}

const getNode = (str) =>
  t.memberExpression(
    t.memberExpression(t.identifier('i18n'), t.identifier('common')),
    t.stringLiteral(str),
    true
  );

const replace = (str) => () => ({
  visitor: {
    CallExpression(path) {
      getImports(path);
      if (isI18nTranslateFunctionWithCommon(path.node, str)) path.replaceWith(getNode(str));
    },
    JSXElement(path) {
      getImports(path);
      if (isFormattedMessageWithCommon(path.node, str)) path.replaceWith(getNode(str));
    },
  },
});

const source1 = `import {fo1o} from 'fzzoo'; \n const foo = i18n.translate({ defaultMessage: "Cancel" });`;
const source2 = `const foo = <FormattedMessage defaultMessage="Cancel"/> `;
// const file = fs.readFileSync('const foo = 1;', { encoding: 'utf-8' });

const src = transformSync(source1, {
  plugins: ['@babel/plugin-syntax-jsx', replace('Cancel')], // TODO: full list of plugins
});

console.log(src.code);
