import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import ts from 'typescript'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'

const repositoryRoot = fileURLToPath(new URL('.', import.meta.url))
const harnessRoot = resolve(process.env.DSH_HARNESS_ROOT ?? `${repositoryRoot}.sandbox/harness`)
const dsh = (relative: string): string => fileURLToPath(new URL(relative, pathToFileURL(`${harnessRoot}/`)))
const decoratorSyntax = /@(?:Remote|RemoteScope)\b/u

/** Pre-transform standard decorators before Vitest's esbuild pass. */
function standardDecoratorPlugin(): Plugin {
  return {
    name: 'dsh-local-share-standard-decorators',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const file = id.split('?', 1)[0]
      if (!/\.[cm]?tsx?$/u.test(file) || !decoratorSyntax.test(code)) return
      const result = ts.transpileModule(code, {
        fileName: file,
        compilerOptions: {
          target: ts.ScriptTarget.ES2024,
          module: ts.ModuleKind.ESNext,
          jsx: file.endsWith('x') ? ts.JsxEmit.ReactJSX : undefined,
          sourceMap: true,
        },
      })
      return {
        code: result.outputText.replace(/\n?\/\/# sourceMappingURL=.*$/u, '\n'),
        map: result.sourceMapText,
      }
    },
  }
}

export default defineConfig({
  plugins: [standardDecoratorPlugin()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@deepseek-ai/dsh-client-runtime/client': dsh('packages/client/runtime/src/client/index.ts'),
      '@deepseek-ai/dsh-client-locale/client': dsh('packages/client/locale/src/client/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/client/index.ts', '.sandbox/**', 'node_modules/**'],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90
      }
    },
  },
})
