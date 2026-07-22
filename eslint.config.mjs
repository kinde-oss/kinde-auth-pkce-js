import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import jest from 'eslint-plugin-jest';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'playground/**',
      'jest.config.ts',
      'setup-tests.ts'
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  jest.configs['flat/recommended'],
  eslintConfigPrettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off'
    }
  }
);
