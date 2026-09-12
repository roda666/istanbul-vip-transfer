import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    // Mirror the paths next lint ignores by default
    ignores: [
      '.next/**',
      '.next-dev/**',
      'node_modules/**',
      'out/**',
      'public/**',
      'next-env.d.ts',   // auto-generated, triple-slash is intentional
      'dist/**',         // compiled output — not source
      'db/**',           // seed & migration scripts — not scanned by next lint
      'scripts/**',      // admin utility scripts — not scanned by next lint
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['tests/admin-acceptance/**/*.ts'],
    rules: {
      // Playwright fixture callbacks conventionally name their continuation
      // argument `use`; it is not React.use and must not be treated as a Hook.
      'react-hooks/rules-of-hooks': 'off',
    },
  },
];

export default eslintConfig;
