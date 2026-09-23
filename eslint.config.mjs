import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Electric client is generated (`npx electric-sql generate`) and is not
    // part of the app's lint surface.
    'src/generated/**',
  ]),
])

export default eslintConfig
