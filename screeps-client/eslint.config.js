import globals from 'globals';
import js from '@eslint/js'
import ts from 'typescript-eslint'
import solid from 'eslint-plugin-solid/configs/recommended'

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  solid,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'solid/no-react-specific-props': 'error',
    },
  },
  {
    ignores: ['dist/', 'node_modules/'],
  },
]
