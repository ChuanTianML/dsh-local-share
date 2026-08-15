// @vitest-environment jsdom
import { Context, Service } from '@deepseek-ai/cordis'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { describe, expect, it, vi } from 'vitest'
import { DshShareHeaderAction } from '../src/client/Dialog.tsx'
import { apply, inject } from '../src/client/index.ts'
import type { DshShareInjected } from '../src/client/Dialog.tsx'
import { fixtureResult } from './fixtures.ts'

class FixtureRemote extends Service {
  readonly mounts: TypertRemoteContribution[] = []
  readonly calls: unknown[] = []

  constructor(private readonly owner: Context) {
    super(owner, 'remote')
  }

  async $mount(contribution: TypertRemoteContribution): Promise<() => Promise<void>> {
    this.mounts.push(contribution)
    const dispose = this.owner.reflect.provide('remote.dshLocalShare', {
      render: async (request: unknown) => {
        this.calls.push(request)
        return { ok: true as const, value: fixtureResult() }
      },
    })
    return async () => { dispose() }
  }
}

async function bench() {
  const ctx = new Context()
  const remote = new FixtureRemote(ctx)
  await ctx.plugin(SlotRegistry)
  const declare = ctx.slots.register({
    name: 'root',
    children: {
      'conversation.session.header.utilities': { kind: 'list', scope: 'session' },
    },
  } as never, (() => null) as never)
  ctx.provide('locale', new LocaleRuntime(ctx))
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber
  return { ctx, remote, fiber, declare }
}

describe('DSH Local Share browser composition', () => {
  it('mounts the Remote and contributes one disposable localized Header action', async () => {
    const b = await bench()
    try {
      expect(inject).toEqual(['slots', 'remote', 'locale'])
      expect(b.remote.mounts).toHaveLength(1)
      const entry = b.ctx.slots.entries('conversation.session.header.utilities')[0]
      expect(entry?.component).toBe(DshShareHeaderAction)
      expect(entry?.options).toMatchObject({ id: 'dsh-local-share', order: 100 })
      expect(entry?.locale).toBe('dsh-local-share')
      expect(document.querySelector('style[data-dsh-local-share="true"]')).not.toBeNull()

      const injected = (entry?.inject as unknown as () => DshShareInjected)()
      const rendered = await injected.render({
        sessionId: 's1', format: 'markdown', includeTools: false, redact: true,
      })
      expect(rendered.filename).toBe('dsh-local-share-2026-08-14.md')
      expect(b.remote.calls).toEqual([{
        sessionId: 's1', format: 'markdown', includeTools: false, redact: true,
      }])
    } finally {
      await b.fiber.dispose()
      b.declare()
    }
    expect(b.ctx.slots.entries('conversation.session.header.utilities')).toHaveLength(0)
    expect(document.querySelector('style[data-dsh-local-share="true"]')).toBeNull()
    expect(b.ctx.reflect.get('remote.dshLocalShare')).toBeUndefined()
  })

  it('surfaces a Remote business error without exposing its details object', async () => {
    const b = await bench()
    try {
      const entry = b.ctx.slots.entries('conversation.session.header.utilities')[0]
      const injected = (entry?.inject as unknown as () => DshShareInjected)()
      const face = b.ctx.reflect.get('remote.dshLocalShare') as {
        render: ReturnType<typeof vi.fn>
      }
      face.render = vi.fn(async () => ({
        ok: false,
        error: { code: 'internal', message: 'safe failure', details: { private: '/Users/alice' } },
      }))
      await expect(injected.render({
        sessionId: 's1', format: 'html', includeTools: false, redact: true,
      })).rejects.toThrow('safe failure')
    } finally {
      await b.fiber.dispose()
      b.declare()
    }
  })
})
