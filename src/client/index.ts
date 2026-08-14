/** Browser plugin that mounts the Remote and contributes the Share header action. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ShareRequest, ShareResult } from '../contract.ts'
import { DshShareHeaderAction, type DshShareInjected } from './Dialog.tsx'
import { en, NS, zh, type DshShareLocaleKey } from './locales.ts'
import { DSH_SHARE_REMOTE } from './remote.ts'
import { adoptStyles } from './styles.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-share': DshShareLocaleKey
  }
}

/** Required browser services. */
export const inject = ['slots', 'remote', 'locale']

interface DshShareNamespaceFace {
  render(request: ShareRequest, signal?: AbortSignal): Promise<
    { ok: true; value: ShareResult }
    | { ok: false; error: { code: string; message: string; details: object } }
  >
}

/** Compose dictionaries, Remote binding, styles, and Session Header entry. */
export function apply(ctx: ClientContext): void {
  ctx.effect(adoptStyles, 'dsh-share: browser styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-share: browser dictionaries')

  let face: DshShareNamespaceFace | undefined
  let disposed = false
  let resolveReady: (value: DshShareNamespaceFace) => void
  let rejectReady: (reason: unknown) => void
  const ready = new Promise<DshShareNamespaceFace>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  void ready.catch(() => {})

  ctx.effect(async () => {
    try {
      const dispose = await ctx.remote.$mount(DSH_SHARE_REMOTE)
      face = (ctx.reflect as unknown as { get(name: string): unknown })
        .get('remote.dshShare') as DshShareNamespaceFace | undefined
      if (face === undefined) throw new Error('dsh-share: the dshShare Remote namespace did not mount')
      resolveReady(face)
      return () => {
        disposed = true
        face = undefined
        void dispose()
      }
    } catch (error) {
      rejectReady(error)
      throw error
    }
  }, 'dsh-share: remote')

  const render = async (request: ShareRequest, signal?: AbortSignal): Promise<ShareResult> => {
    const remote = face ?? await ready
    if (disposed) throw new Error('dsh-share: browser plugin is disposed')
    const result = await remote.render(request, signal)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }

  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'dsh-share',
    order: 100,
    locale: NS,
    inject: (): DshShareInjected => ({ render }),
  }, DshShareHeaderAction))
}

export type { DshShareInjected, DshShareProps } from './Dialog.tsx'
