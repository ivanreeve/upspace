import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { FlatCompat } from '@eslint/eslintrc';
import importNewlines from 'eslint-plugin-import-newlines';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname, });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    plugins: { 'import-newlines': importNewlines, },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'semi': ['error', 'always'],
      'object-curly-spacing': ['error', 'always'],
      'object-curly-newline': ['error', {
        'ObjectExpression': {
          'multiline': true,
          'minProperties': 2,
        },
        'ObjectPattern': {
          'multiline': true,
          'minProperties': 2,
        },
      }],
      'object-property-newline': ['error', { 'allowAllPropertiesOnSameLine': false, }],
      'react/jsx-curly-spacing': ['error', {
        when: 'always',
        children: true,
        allowMultiline: true,
      }],
      'import/order': ['error', { 'newlines-between': 'always', }],
      'import-newlines/enforce': ['error', { items: 1, }],
      'quotes': ['error', 'single', {
        avoidEscape: true,
        allowTemplateLiterals: true,
      }],
      'comma-dangle': ['error', { objects: 'always', }],
    },
  }
];

export default eslintConfig;
