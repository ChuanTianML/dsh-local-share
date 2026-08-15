/** Host Remote that reads one Session atomically and renders a share file. */
import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-query'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { ShareRequest, ShareResult } from './contract.ts'
import { renderShare } from './render.ts'
import type { ShareLimits } from './render.ts'

/** Strict `dshLocalShare` service exposed through the Host Gateway. */
export class DshShareRuntime extends TypertRemoteService {
  /**
   * Register the service and its resource limits.
   * @param ctx - owning Cordis context.
   * @param limits - validated render limits.
   */
  constructor(ctx: Context, private readonly limits: ShareLimits) {
    super(ctx, 'dshLocalShare')
  }

  /**
   * Read and render one Session without disclosing backend errors.
   * @param request - Session id, format, and privacy choices.
   * @param signal - browser request lifetime.
   * @returns local file source and isolated preview HTML.
   */
  @Remote
  async render(request: ShareRequest, signal?: AbortSignal): Promise<ShareResult> {
    signal?.throwIfAborted()
    let snapshot
    try {
      snapshot = await this.ctx.sessionQuery.readSession(SessionId(request.sessionId))
    } catch {
      signal?.throwIfAborted()
      throw new Error('dsh-local-share: unable to read this Session')
    }
    signal?.throwIfAborted()
    return renderShare(snapshot, request, this.limits)
  }
}
