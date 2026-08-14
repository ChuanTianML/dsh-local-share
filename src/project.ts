/** Projection from a validated raw Session log into share-safe document entries. */
import type { SessionEvent, UserMessage } from '@deepseek-ai/dsh-session'
import { foldSessionTitle } from '@deepseek-ai/dsh-session-title'
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

/** Ordered content and audit counts before formatting. */
export interface ShareDocument {
  title: string
  entries: Array<ShareMessageEntry | ShareToolEntry>
  stats: {
    messages: number
    toolCalls: number
    attachmentsOmitted: number
    injectedMessagesOmitted: number
    toolArgumentsTruncated: number
  }
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
        parts.push('[Image omitted]')
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
 * Project one complete Session log into the content users may share.
 * @param events - replay-validated raw Session events.
 * @param includeTools - whether tool calls enter the output.
 * @param maxToolArgumentChars - per-call argument retention limit.
 * @returns ordered entries and omission statistics.
 */
export function projectSession(
  events: readonly SessionEvent[],
  includeTools: boolean,
  maxToolArgumentChars: number,
): ShareDocument {
  const title = foldSessionTitle(events)?.title ?? 'DSH Session'
  const outcomes = toolOutcomes(events)
  const entries: ShareDocument['entries'] = []
  let messages = 0
  let toolCalls = 0
  let attachmentsOmitted = 0
  let injectedMessagesOmitted = 0
  let toolArgumentsTruncated = 0

  for (const event of events) {
    switch (event.type) {
      case 'user/message': {
        if (event.data.source.kind !== 'user') {
          injectedMessagesOmitted += 1
          break
        }
        if (event.surfaceOp !== 'append') break
        const projected = visibleText(event.data.content)
        attachmentsOmitted += projected.attachments
        if (projected.text.length === 0) break
        entries.push({ kind: 'message', role: 'user', text: projected.text })
        messages += 1
        break
      }
      case 'assistant/message': {
        if (event.surfaceOp !== 'append') break
        const projected = visibleText(event.data.message.content)
        attachmentsOmitted += projected.attachments
        if (projected.text.length === 0) break
        entries.push({ kind: 'message', role: 'assistant', text: projected.text })
        messages += 1
        break
      }
      case 'tool/call': {
        toolCalls += 1
        if (!includeTools) break
        const truncated = event.data.arguments.length > maxToolArgumentChars
        if (truncated) toolArgumentsTruncated += 1
        const outcome = outcomes.get(String(event.data.callId)) ?? { status: 'unknown' as const }
        entries.push({
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

  return {
    title,
    entries,
    stats: {
      messages,
      toolCalls,
      attachmentsOmitted,
      injectedMessagesOmitted,
      toolArgumentsTruncated,
    },
  }
}

/**
 * Apply redaction to every emitted string before format-specific escaping.
 * @param document - projected share document.
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
    entries: document.entries.map(entry => entry.kind === 'message'
      ? { ...entry, text: redact(entry.text) }
      : {
          ...entry,
          name: redact(entry.name),
          arguments: redact(entry.arguments),
          ...entry.errorCode === undefined ? {} : { errorCode: redact(entry.errorCode) },
        }),
    stats: { ...document.stats },
    redactions,
  }
}
