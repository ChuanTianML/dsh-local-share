/** Markdown, self-contained HTML, and isolated preview rendering. */
import type { SessionLogSnapshot } from '@deepseek-ai/dsh-session-query';
import type { ShareRequest, ShareResult } from './contract.ts';
/** Validated Host-side resource limits. */
export interface ShareLimits {
    maxEvents: number;
    maxOutputChars: number;
    maxToolArgumentChars: number;
}
/** Safe, user-visible failure caused by an explicit export limit. */
export declare class ShareRenderError extends Error {
    readonly name = "ShareRenderError";
}
/**
 * Render one atomic Session observation into a local file and safe preview.
 * @param snapshot - complete replay-validated Session observation.
 * @param request - format and privacy options.
 * @param limits - validated Host resource limits.
 * @param now - generation time, injectable for deterministic tests.
 * @returns strict Remote result.
 */
export declare function renderShare(snapshot: SessionLogSnapshot, request: ShareRequest, limits: ShareLimits, now?: Date): ShareResult;
