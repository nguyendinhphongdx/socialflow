import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'app',
  typescript: true,
  formatters: true,
  stylistic: {
    indent: 2,
    quotes: 'single',
    semi: false,
  },
  ignores: [
    '**/dist/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/node_modules/**',
    '**/.prisma/**',
    '**/generated/**',
    '**/coverage/**',
    '**/*.min.js',
    'apps/extension/dist/**',
  ],
  rules: {
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'ts/no-explicit-any': 'error',
    'ts/no-non-null-assertion': 'warn',
    'antfu/no-top-level-await': 'off',
  },
})
