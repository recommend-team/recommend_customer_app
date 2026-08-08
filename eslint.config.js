import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // `lib/` is framework-agnostic and must stay importable from a native app, so
      // React-specific rules there would be noise rather than signal.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Vite config runs in Node, not the browser.
    files: ['vite.config.ts', 'eslint.config.js'],
    languageOptions: { globals: { process: 'readonly' } },
  },
);
