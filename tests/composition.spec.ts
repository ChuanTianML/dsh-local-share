import { Context, Service } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { SessionLogSnapshot } from '@deepseek-ai/dsh-session-query'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import { describe, expect, it } from 'vitest'
import * as plugin from '../src/index.ts'
import type { DshShareRuntime } from '../src/runtime.ts'
import { fixtureSnapshot } from './fixtures.ts'

class FixtureSessionQuery extends Service {
  constructor(
    ctx: Context,
    private readonly reader: (id: SessionId) => Promise<SessionLogSnapshot>,
  ) {
    super(ctx, 'sessionQuery')
  }

  readSession(id: SessionId): Promise<SessionLogSnapshot> {
    return this.reader(id)
  }
}

async function mount(reader: (id: SessionId) => Promise<SessionLogSnapshot> = async () => fixtureSnapshot()) {
  const ctx = new Context()
  new FixtureSessionQuery(ctx, reader)
  const registryFiber = ctx.plugin(TypertRegistry)
  await registryFiber
  const fiber = ctx.plugin({ inject: [...plugin.inject], apply: plugin.apply })
  await fiber
  return { ctx, fiber, registryFiber }
}

describe('DSH Local Share Host composition', () => {
  it('loads defaults, provides the service, and registers one strict invocation', async () => {
    const b = await mount()
    try {
      expect(plugin.inject).toEqual(['sessionQuery', 'typert'])
      expect(plugin.Config({})).toEqual({
        maxEvents: plugin.DEFAULT_MAX_EVENTS,
        maxOutputChars: plugin.DEFAULT_MAX_OUTPUT_CHARS,
        maxToolArgumentChars: plugin.DEFAULT_MAX_TOOL_ARGUMENT_CHARS,
      })
      expect(() => plugin.Config({ maxEvents: 0 })).toThrow()
      expect(b.ctx.get('dshLocalShare')).toBeInstanceOf(plugin.DshShareRuntime)
      expect(b.ctx.typert.local.get('dshLocalShare/render')).toMatchObject({
        id: 'dsh-local-share#dshLocalShare/render',
        service: 'dshLocalShare',
        method: 'render',
      })
    } finally {
      await b.fiber.dispose()
      await b.registryFiber.dispose()
    }
  })

  it('renders through the composed service and withdraws it on disposal', async () => {
    const seen: string[] = []
    const b = await mount(async id => {
      seen.push(String(id))
      return fixtureSnapshot()
    })
    const runtime = b.ctx.get('dshLocalShare') as DshShareRuntime
    const result = await runtime.render({
      sessionId: 'session-private-id', format: 'markdown', includeTools: false, redact: true,
    })
    expect(seen).toEqual(['session-private-id'])
    expect(result.content).toContain('[REDACTED_SECRET]')
    await b.fiber.dispose()
    expect(b.ctx.get('dshLocalShare')).toBeUndefined()
    expect(b.ctx.typert.local.get('dshLocalShare/render')).toBeUndefined()
    await b.registryFiber.dispose()
  })

  it('sanitizes a backend read failure before it crosses the Remote', async () => {
    const b = await mount(async () => {
      throw new Error('failed to open /Users/alice/private/session.jsonl')
    })
    try {
      const runtime = b.ctx.get('dshLocalShare') as DshShareRuntime
      await expect(runtime.render({
        sessionId: 's1', format: 'html', includeTools: false, redact: true,
      })).rejects.toThrow('dsh-local-share: unable to read this Session')
      await expect(runtime.render({
        sessionId: 's1', format: 'html', includeTools: false, redact: true,
      })).rejects.not.toThrow('/Users/alice')
    } finally {
      await b.fiber.dispose()
      await b.registryFiber.dispose()
    }
  })

  it('rejects an already-cancelled call before reading', async () => {
    let reads = 0
    const b = await mount(async () => {
      reads += 1
      return fixtureSnapshot()
    })
    try {
      const runtime = b.ctx.get('dshLocalShare') as DshShareRuntime
      const cancelled = new AbortController()
      cancelled.abort()
      await expect(runtime.render({
        sessionId: 's1', format: 'markdown', includeTools: false, redact: true,
      }, cancelled.signal)).rejects.toMatchObject({ name: 'AbortError' })
      expect(reads).toBe(0)
    } finally {
      await b.fiber.dispose()
      await b.registryFiber.dispose()
    }
  })
})
