import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  { ignores: ['**/node_modules/**', 'client/dist/**'] },
  js.configs.recommended,
  {
    files: ['*.js', 'server/**/*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['client/**/*.{js,jsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Komponenten (Großbuchstabe) werden nur in JSX verwendet, das erkennt ESLint allein nicht
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z]' }],
    },
  },
];
