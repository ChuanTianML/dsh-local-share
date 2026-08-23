/** Projection from a validated raw Session log into share-safe turns. */
import type { SessionEvent, UserMessage } from '@deepseek-ai/dsh-session'
import { foldSessionTitle } from '@deepseek-ai/dsh-session-title'
import type { ShareTurn as ShareTurnSummary } from './contract.ts'
import { redactText } from './redact.ts'

/** A human or assistant message retained for export. */
export interface ShareMessageEntry {
  kind: 'message'
  role: 'user' | 'assistant'
  text: string
}

/** One optional tool call retained without its result body. */
export interface ShareToolEntry {
  kind: 'tool'
  name: string
  arguments: string
  status: 'succeeded' | 'failed' | 'unknown'
  errorCode?: string
  truncated: boolean
}

/** Content that can enter one rendered turn. */
export type ShareEntry = ShareMessageEntry | ShareToolEntry

/** Audit counts owned by one selected set of turns. */
export interface ShareProjectionStats {
  turns: number
  messages: number
  toolCalls: number
  attachmentsOmitted: number
  injectedMessagesOmitted: number
  toolArgumentsTruncated: number
}

/** One user-led turn and all following visible activity until the next prompt. */
export interface ShareProjectedTurn {
  startSeq: number
  entries: ShareEntry[]
  stats: Omit<ShareProjectionStats, 'turns'>
}

/** Ordered turns and audit counts before formatting. */
export interface ShareDocument {
  title: string
  turns: ShareProjectedTurn[]
  stats: ShareProjectionStats
}

/** Share document after optional redaction. */
export interface RedactedShareDocument extends ShareDocument {
  redactions: number
}

interface TextProjection {
  text: string
  attachments: number
}

type ContentBlock = UserMessage['content'][number]

function emptyTurnStats(): ShareProjectedTurn['stats'] {
  return {
    messages: 0,
    toolCalls: 0,
    attachmentsOmitted: 0,
    injectedMessagesOmitted: 0,
    toolArgumentsTruncated: 0,
  }
}

function aggregateStats(turns: readonly ShareProjectedTurn[]): ShareProjectionStats {
  return turns.reduce<ShareProjectionStats>((stats, turn) => ({
    turns: stats.turns + 1,
    messages: stats.messages + turn.stats.messages,
    toolCalls: stats.toolCalls + turn.stats.toolCalls,
    attachmentsOmitted: stats.attachmentsOmitted + turn.stats.attachmentsOmitted,
    injectedMessagesOmitted: stats.injectedMessagesOmitted + turn.stats.injectedMessagesOmitted,
    toolArgumentsTruncated: stats.toolArgumentsTruncated + turn.stats.toolArgumentsTruncated,
  }), {
    turns: 0,
    messages: 0,
    toolCalls: 0,
    attachmentsOmitted: 0,
    injectedMessagesOmitted: 0,
    toolArgumentsTruncated: 0,
  })
}

/** Keep visible text, replace image blocks, and ignore internal block types. */
function visibleText(content: readonly ContentBlock[]): TextProjection {
  const parts: string[] = []
  let attachments = 0
  for (const block of content) {
    switch (block.type) {
      case 'text':
        parts.push(block.text)
        break
      case 'image':
        parts.push('Image omitted')
        attachments += 1
        break
      case 'reasoning':
      case 'tool-call':
      case 'tool-result':
        break
      default:
        // ContentBlockMap is merge-extensible. Unknown plugin blocks remain private.
        break
    }
  }
  return { text: parts.join('\n\n').trim(), attachments }
}

interface ToolOutcome {
  status: ShareToolEntry['status']
  errorCode?: string
}

/** Index final tool outcomes without retaining model-facing result text. */
function toolOutcomes(events: readonly SessionEvent[]): ReadonlyMap<string, ToolOutcome> {
  const outcomes = new Map<string, ToolOutcome>()
  for (const event of events) {
    if (event.type !== 'tool/result') continue
    const result = event.data.message.content[0]
    const failed = event.data.error !== undefined || result.isError === true
    outcomes.set(String(event.data.message.source.callId), {
      status: failed ? 'failed' : 'succeeded',
      ...event.data.error === undefined ? {} : { errorCode: event.data.error.code },
    })
  }
  return outcomes
}

/**
 * Project one complete Session log into user-led turns that may be shared.
 * @param events - replay-validated raw Session events.
 * @param includeTools - whether tool calls enter the output.
 * @param maxToolArgumentChars - per-call argument retention limit.
 * @returns ordered turns and omission statistics.
 */
export function projectSession(
  events: readonly SessionEvent[],
  includeTools: boolean,
  maxToolArgumentChars: number,
): ShareDocument {
  const title = foldSessionTitle(events)?.title ?? 'DSH Session'
  const outcomes = toolOutcomes(events)
  const turns: ShareProjectedTurn[] = []
  let currentTurn: ShareProjectedTurn | undefined
  let pendingInjectedMessages = 0

  const beginTurn = (startSeq: number): ShareProjectedTurn => {
    const turn: ShareProjectedTurn = {
      startSeq,
      entries: [],
      stats: emptyTurnStats(),
    }
    if (turns.length === 0 && pendingInjectedMessages > 0) {
      turn.stats.injectedMessagesOmitted = pendingInjectedMessages
      pendingInjectedMessages = 0
    }
    turns.push(turn)
    currentTurn = turn
    return turn
  }
  const ensureTurn = (startSeq: number): ShareProjectedTurn => currentTurn ?? beginTurn(startSeq)

  for (const event of events) {
    switch (event.type) {
      case 'user/message': {
        if (event.data.source.kind !== 'user') {
          if (currentTurn === undefined) pendingInjectedMessages += 1
          else currentTurn.stats.injectedMessagesOmitted += 1
          break
        }
        if (event.surfaceOp !== 'append') break
        const turn = beginTurn(event.seq)
        const projected = visibleText(event.data.content)
        turn.stats.attachmentsOmitted += projected.attachments
        if (projected.text.length === 0) break
        turn.entries.push({ kind: 'message', role: 'user', text: projected.text })
        turn.stats.messages += 1
        break
      }
      case 'assistant/message': {
        if (event.surfaceOp !== 'append') break
        const turn = ensureTurn(event.seq)
        const projected = visibleText(event.data.message.content)
        turn.stats.attachmentsOmitted += projected.attachments
        if (projected.text.length === 0) break
        turn.entries.push({ kind: 'message', role: 'assistant', text: projected.text })
        turn.stats.messages += 1
        break
      }
      case 'tool/call': {
        const turn = ensureTurn(event.seq)
        turn.stats.toolCalls += 1
        if (!includeTools) break
        const truncated = event.data.arguments.length > maxToolArgumentChars
        if (truncated) turn.stats.toolArgumentsTruncated += 1
        const outcome = outcomes.get(String(event.data.callId)) ?? { status: 'unknown' as const }
        turn.entries.push({
          kind: 'tool',
          name: event.data.name,
          arguments: truncated
            ? `${event.data.arguments.slice(0, maxToolArgumentChars)}\n… [truncated]`
            : event.data.arguments,
          status: outcome.status,
          ...outcome.errorCode === undefined ? {} : { errorCode: outcome.errorCode },
          truncated,
        })
        break
      }
      default:
        // SessionEventMap is merge-extensible. Non-share events are intentionally ignored.
        break
    }
  }

  return { title, turns, stats: aggregateStats(turns) }
}

/**
 * Retain an explicit turn subset without changing its log order.
 * @param document - complete projected Session.
 * @param selectedTurnSeqs - selected turn starts, or `null` for all turns.
 * @returns detached selected document with recomputed statistics.
 */
export function selectTurns(
  document: ShareDocument,
  selectedTurnSeqs: readonly number[] | null,
): ShareDocument {
  if (selectedTurnSeqs === null) {
    const turns = [...document.turns]
    return { title: document.title, turns, stats: aggregateStats(turns) }
  }
  const selected = new Set(selectedTurnSeqs)
  const turns = document.turns.filter(turn => selected.has(turn.startSeq))
  return { title: document.title, turns, stats: aggregateStats(turns) }
}

function turnPreview(turn: ShareProjectedTurn): string {
  const preferred = turn.entries.find(entry => entry.kind === 'message' && entry.role === 'user')
    ?? turn.entries.find(entry => entry.kind === 'message')
    ?? turn.entries[0]
  const text = preferred?.kind === 'message' ? preferred.text : preferred?.name ?? ''
  const collapsed = text.replace(/[\t\n\r ]+/gu, ' ').trim()
  return collapsed.length > 160 ? `${collapsed.slice(0, 159)}…` : collapsed
}

/**
 * Produce privacy-matched metadata for the browser turn selector.
 * @param document - complete projected Session before selection.
 * @param redact - whether selector previews must be redacted.
 * @returns stable turn starts and bounded previews.
 */
export function summarizeTurns(document: ShareDocument, redact: boolean): ShareTurnSummary[] {
  return document.turns.map(turn => {
    const preview = turnPreview(turn)
    return {
      startSeq: turn.startSeq,
      preview: redact ? redactText(preview).text : preview,
      messages: turn.stats.messages,
      toolCalls: turn.stats.toolCalls,
    }
  })
}

/**
 * Apply redaction to every emitted string before format-specific escaping.
 * @param document - selected share document.
 * @param enabled - whether redaction is active.
 * @returns detached document plus its aggregate replacement count.
 */
export function redactDocument(document: ShareDocument, enabled: boolean): RedactedShareDocument {
  let redactions = 0
  const redact = (value: string): string => {
    if (!enabled) return value
    const result = redactText(value)
    redactions += result.count
    return result.text
  }
  return {
    title: redact(document.title),
    turns: document.turns.map(turn => ({
      startSeq: turn.startSeq,
      entries: turn.entries.map(entry => entry.kind === 'message'
        ? { ...entry, text: redact(entry.text) }
        : {
            ...entry,
            name: redact(entry.name),
            arguments: redact(entry.arguments),
            ...entry.errorCode === undefined ? {} : { errorCode: redact(entry.errorCode) },
          }),
      stats: { ...turn.stats },
    })),
    stats: { ...document.stats },
    redactions,
  }
}
