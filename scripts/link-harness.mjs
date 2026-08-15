/** Link the exact DSH development packages used by this out-of-tree plugin. */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  symlinkSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { URL, fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const harness = resolve(process.env.DSH_HARNESS_ROOT ?? join(root, '.sandbox/harness'))
const modules = join(root, 'node_modules')

if (!existsSync(join(harness, 'package.json'))) {
  throw new Error(`dsh-local-share: Harness checkout not found at ${harness}; clone deepseek-ai/deepseek-harness there or set DSH_HARNESS_ROOT`)
}
if (!existsSync(modules)) {
  throw new Error('dsh-local-share: node_modules is missing; run pnpm install before a development command')
}

const packages = new Map([
  ['@deepseek-ai/cordis', 'vendor/cordis'],
  ['@deepseek-ai/schemastery', 'vendor/schemastery'],
  ['@deepseek-ai/dsh-client-locale', 'packages/client/locale'],
  ['@deepseek-ai/dsh-client-runtime', 'packages/client/runtime'],
  ['@deepseek-ai/dsh-client-ui-conversation', 'packages/client/ui-conversation'],
  ['@deepseek-ai/dsh-client-ui-primitives', 'packages/client/ui-primitives'],
  ['@deepseek-ai/dsh-client-ui-slots', 'packages/client/ui-slots'],
  ['@deepseek-ai/dsh-session', 'packages/core/session'],
  ['@deepseek-ai/dsh-session-query', 'packages/session-query/session-query'],
  ['@deepseek-ai/dsh-session-title', 'packages/session/session-title'],
  ['@deepseek-ai/dsh-typert-protocol', 'packages/typert/protocol'],
  ['@deepseek-ai/dsh-typert-registry', 'packages/typert/registry'],
])

for (const [name, relative] of packages) {
  const target = join(harness, relative)
  const link = join(modules, ...name.split('/'))
  if (!existsSync(join(target, 'package.json'))) {
    throw new Error(`dsh-local-share: expected Harness package ${name} at ${target}`)
  }
  mkdirSync(dirname(link), { recursive: true })
  if (existsSync(link)) {
    const existing = lstatSync(link)
    if (existing.isSymbolicLink() && realpathSync(link) === realpathSync(target)) continue
    throw new Error(`dsh-local-share: refusing to replace existing dependency at ${link}`)
  }
  symlinkSync(target, link, 'dir')
}
