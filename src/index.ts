/** DSH Local Share Host plugin: Session projection service and strict Typert manifest. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-typert-registry'
import z from '@deepseek-ai/schemastery'
import { DshShareRuntime } from './runtime.ts'
import { TYPERT_MANIFEST } from './typert.ts'

/** Cordis plugin and client module id. */
export const name = 'dsh-local-share'

/** Services required before the Host plugin loads. */
export const inject = ['sessionQuery', 'typert']

/** Maximum raw events accepted by default. */
export const DEFAULT_MAX_EVENTS = 20_000

/** Maximum characters accepted in either generated output by default. */
export const DEFAULT_MAX_OUTPUT_CHARS = 2_000_000

/** Maximum arguments retained for one enabled tool call by default. */
export const DEFAULT_MAX_TOOL_ARGUMENT_CHARS = 12_000

/** Deployment-varying Host limits. */
export interface Config {
  /** Maximum raw events read from one Session. */
  maxEvents?: number
  /** Maximum characters in a generated file or preview. */
  maxOutputChars?: number
  /** Maximum argument characters retained per enabled tool call. */
  maxToolArgumentChars?: number
}

/** Configuration schema with positive-integer defaults. */
export const Config = z.object({
  maxEvents: z.number().step(1).min(1).default(DEFAULT_MAX_EVENTS),
  maxOutputChars: z.number().step(1).min(1).default(DEFAULT_MAX_OUTPUT_CHARS),
  maxToolArgumentChars: z.number().step(1).min(1).default(DEFAULT_MAX_TOOL_ARGUMENT_CHARS),
})

/**
 * Mount the share service and strict wire manifest.
 * @param ctx - Host Cordis context.
 * @param config - validated deployment limits.
 */
export function apply(ctx: Context, config?: Config): void {
  const resolved = Config(config ?? {})
  new DshShareRuntime(ctx, resolved)
  ctx.effect(() => {
    const dispose = ctx.typert.register(TYPERT_MANIFEST)
    return () => { void dispose() }
  }, 'dsh-local-share: typert manifest')
}

export type { ShareRequest, ShareResult, ShareWarning } from './contract.ts'
export { DshShareRuntime } from './runtime.ts'
export { ShareRenderError, renderShare } from './render.ts'
