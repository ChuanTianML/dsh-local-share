/** Projection from a validated raw Session log into share-safe document entries. */
import type { SessionEvent } from '@deepseek-ai/dsh-session';
/** A human or assistant message retained for export. */
export interface ShareMessageEntry {
    kind: 'message';
    role: 'user' | 'assistant';
    text: string;
}
/** One optional tool call retained without its result body. */
export interface ShareToolEntry {
    kind: 'tool';
    name: string;
    arguments: string;
    status: 'succeeded' | 'failed' | 'unknown';
    errorCode?: string;
    truncated: boolean;
}
/** Ordered content and audit counts before formatting. */
export interface ShareDocument {
    title: string;
    entries: Array<ShareMessageEntry | ShareToolEntry>;
    stats: {
        messages: number;
        toolCalls: number;
        attachmentsOmitted: number;
        injectedMessagesOmitted: number;
        toolArgumentsTruncated: number;
    };
}
/** Share document after optional redaction. */
export interface RedactedShareDocument extends ShareDocument {
    redactions: number;
}
/**
 * Project one complete Session log into the content users may share.
 * @param events - replay-validated raw Session events.
 * @param includeTools - whether tool calls enter the output.
 * @param maxToolArgumentChars - per-call argument retention limit.
 * @returns ordered entries and omission statistics.
 */
export declare function projectSession(events: readonly SessionEvent[], includeTools: boolean, maxToolArgumentChars: number): ShareDocument;
/**
 * Apply redaction to every emitted string before format-specific escaping.
 * @param document - projected share document.
 * @param enabled - whether redaction is active.
 * @returns detached document plus its aggregate replacement count.
 */
export declare function redactDocument(document: ShareDocument, enabled: boolean): RedactedShareDocument;
