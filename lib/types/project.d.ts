/** Projection from a validated raw Session log into share-safe turns. */
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { ShareTurn as ShareTurnSummary } from './contract.ts';
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
/** Content that can enter one rendered turn. */
export type ShareEntry = ShareMessageEntry | ShareToolEntry;
/** Audit counts owned by one selected set of turns. */
export interface ShareProjectionStats {
    turns: number;
    messages: number;
    toolCalls: number;
    attachmentsOmitted: number;
    injectedMessagesOmitted: number;
    toolArgumentsTruncated: number;
}
/** One user-led turn and all following visible activity until the next prompt. */
export interface ShareProjectedTurn {
    startSeq: number;
    entries: ShareEntry[];
    stats: Omit<ShareProjectionStats, 'turns'>;
}
/** Ordered turns and audit counts before formatting. */
export interface ShareDocument {
    title: string;
    turns: ShareProjectedTurn[];
    stats: ShareProjectionStats;
}
/** Share document after optional redaction. */
export interface RedactedShareDocument extends ShareDocument {
    redactions: number;
}
/**
 * Project one complete Session log into user-led turns that may be shared.
 * @param events - replay-validated raw Session events.
 * @param includeTools - whether tool calls enter the output.
 * @param maxToolArgumentChars - per-call argument retention limit.
 * @returns ordered turns and omission statistics.
 */
export declare function projectSession(events: readonly SessionEvent[], includeTools: boolean, maxToolArgumentChars: number): ShareDocument;
/**
 * Retain an explicit turn subset without changing its log order.
 * @param document - complete projected Session.
 * @param selectedTurnSeqs - selected turn starts, or `null` for all turns.
 * @returns detached selected document with recomputed statistics.
 */
export declare function selectTurns(document: ShareDocument, selectedTurnSeqs: readonly number[] | null): ShareDocument;
/**
 * Produce privacy-matched metadata for the browser turn selector.
 * @param document - complete projected Session before selection.
 * @param redact - whether selector previews must be redacted.
 * @returns stable turn starts and bounded previews.
 */
export declare function summarizeTurns(document: ShareDocument, redact: boolean): ShareTurnSummary[];
/**
 * Apply redaction to every emitted string before format-specific escaping.
 * @param document - selected share document.
 * @param enabled - whether redaction is active.
 * @returns detached document plus its aggregate replacement count.
 */
export declare function redactDocument(document: ShareDocument, enabled: boolean): RedactedShareDocument;
