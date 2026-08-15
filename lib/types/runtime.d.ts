/** Host Remote that reads one Session atomically and renders a share file. */
import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ShareRequest, ShareResult } from './contract.ts';
import type { ShareLimits } from './render.ts';
/** Strict `dshLocalShare` service exposed through the Host Gateway. */
export declare class DshShareRuntime extends TypertRemoteService {
    private readonly limits;
    /**
     * Register the service and its resource limits.
     * @param ctx - owning Cordis context.
     * @param limits - validated render limits.
     */
    constructor(ctx: Context, limits: ShareLimits);
    /**
     * Read and render one Session without disclosing backend errors.
     * @param request - Session id, format, and privacy choices.
     * @param signal - browser request lifetime.
     * @returns local file source and isolated preview HTML.
     */
    render(request: ShareRequest, signal?: AbortSignal): Promise<ShareResult>;
}
