import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const vendor = { group: ['@/ui/vendor/*'], message: 'Import from @/ui (the wrapper), not vendor.' }
const backend = {
  group: ['@/api/adapters/*', '@/api/mocks/*'],
  message: 'Use @/api/queries and @/domain types. Only adapters know backend shapes.',
}
const crossFeature = { group: ['@/features/*'], message: 'Features never import other features.' }

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'public', 'src/ui/vendor', '.claude', '.agents', 'tools'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // Architecture invariants from CLAUDE.md, enforced by lint.
  {
    files: ['src/map/**', 'src/ui/**', 'src/lib/**', 'src/state/**', 'src/domain/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [backend, crossFeature] }] },
  },
  {
    files: ['src/features/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [vendor, backend, crossFeature] }] },
  },
)
