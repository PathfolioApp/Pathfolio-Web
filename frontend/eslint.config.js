import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

/**
 * PathfolioApp frontend lint gate.
 *
 * Focused on the two classes of bugs that actually bite this codebase:
 * - React hook misuse (rules-of-hooks, exhaustive-deps)
 * - Accessibility slips on JSX (label association, aria usage)
 * Stylistic rules are deliberately left to the team; the build is the style
 * arbiter. Run: pnpm --dir frontend run lint
 */
export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { window: 'readonly', document: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly', fetch: 'readonly', URL: 'readonly', Blob: 'readonly', FormData: 'readonly', EventSource: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly', navigator: 'readonly', history: 'readonly', location: 'readonly', import: 'readonly', URLSearchParams: 'readonly', FileReader: 'readonly', ResizeObserver: 'readonly', alert: 'readonly', requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly', CustomEvent: 'readonly' }
    },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...js.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-is-valid': 'warn',
      'jsx-a11y/label-has-associated-control': 'warn',
      // The codebase uses the modern JSX transform: `import React` is optional.
      // Unused *imports* are noise; unused local logic is still caught by the
      // build (rollup) and by code review. Keep this gate about real bugs.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^(React|_)' }],
      'no-undef': 'error'
    }
  },
  { ignores: ['dist/**', 'node_modules/**'] }
];
