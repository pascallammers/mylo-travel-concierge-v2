import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.claude/**',
    '.factory/**',
    '.droidz/**',
    'documentation/**',
    'docs/**',
    'tasks/**',
    'orchestrator/**',
    'scripts/**',
    'node_modules/**',
  ]),
  {
    rules: {
      // React Compiler rules shipped with eslint-plugin-react-hooks v7.
      // Keep them off for this upgrade; they flag existing patterns, not Next 16 breakages.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/unsupported-syntax': 'off',
      'react-hooks/immutability': 'off',
    },
  },
]);

export default eslintConfig;
