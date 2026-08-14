import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionLogSnapshot } from '@deepseek-ai/dsh-session-query'
import type { ShareResult } from '../src/contract.ts'

/** Representative raw log with private text, internal context, tools, and a replacement. */
export function fixtureSnapshot(): SessionLogSnapshot {
  const events = [
    {
      type: 'session/title', seq: 0, time: 1,
      data: { title: 'Private /Users/alice/project', messageSeqs: [], source: { kind: 'user' } },
    },
    {
      type: 'user/message', seq: 1, time: 2, surfaceOp: 'append',
      data: {
        id: 'user-1', role: 'user', source: { kind: 'user' },
        content: [
          { type: 'text', text: 'Use apiKey=sk-abcdefghijklmnop for alice@example.com.\n<img src="https://tracker.invalid/x">\n![pixel](https://tracker.invalid/pixel)' },
          { type: 'image', attachment: { id: 'attachment-private' } },
        ],
      },
    },
    {
      type: 'user/message', seq: 2, time: 3, surfaceOp: 'append',
      data: {
        id: 'plugin-1', role: 'user', source: { kind: 'plugin', plugin: 'instructions' },
        content: [{ type: 'text', text: 'INTERNAL SYSTEM CONTEXT' }],
      },
    },
    {
      type: 'assistant/message', seq: 3, time: 4, surfaceOp: 'append',
      data: {
        turn: 1, step: 1,
        message: {
          id: 'assistant-1', role: 'assistant', source: { kind: 'model', provider: 'fixture', model: 'fixture' },
          content: [
            { type: 'reasoning', text: 'PRIVATE CHAIN OF THOUGHT' },
            { type: 'text', text: 'I will update `/Users/alice/project/app.ts`.' },
          ],
        },
      },
    },
    {
      type: 'tool/call', seq: 4, time: 5,
      data: {
        turn: 1, step: 1, callId: 'call-1', name: 'shell/bash',
        arguments: '{"cmd":"printf secret","cwd":"/Users/alice/project"}',
      },
    },
    {
      type: 'tool/result', seq: 5, time: 6, surfaceOp: 'append',
      data: {
        turn: 1, step: 1,
        message: {
          id: 'result-1', role: 'user', source: { kind: 'tool', callId: 'call-1' },
          content: [{ type: 'tool-result', toolCallId: 'call-1', content: [{ type: 'text', text: 'PRIVATE TOOL OUTPUT' }] }],
        },
      },
    },
    {
      type: 'assistant/message', seq: 6, time: 7,
      surfaceOp: { op: 'replace', start: 1, end: 5 }, sourceEventSeqs: [1, 2, 3, 5],
      data: {
        turn: 2, step: 1,
        message: {
          id: 'assistant-replacement', role: 'assistant', source: { kind: 'model', provider: 'fixture', model: 'fixture' },
          content: [{ type: 'text', text: 'INTERNAL COMPACTION SUMMARY' }],
        },
      },
    },
  ] as unknown as SessionEvent[]
  return {
    session: {
      version: 0,
      id: 'session-private-id' as SessionId,
      createdAt: 1,
      cwd: '/Users/alice/project',
    },
    events,
  }
}

/** Valid browser result for component and download tests. */
export function fixtureResult(overrides: Partial<ShareResult> = {}): ShareResult {
  return {
    filename: 'dsh-share-2026-08-14.md',
    mimeType: 'text/markdown;charset=utf-8',
    content: '# Shared',
    previewHtml: '<!doctype html><html><body>Shared preview</body></html>',
    generatedAt: '2026-08-14T00:00:00.000Z',
    capturedThroughSeq: 6,
    warnings: ['redaction-best-effort'],
    stats: {
      messages: 2,
      toolCalls: 1,
      redactions: 3,
      attachmentsOmitted: 1,
      injectedMessagesOmitted: 1,
      toolArgumentsTruncated: 0,
    },
    ...overrides,
  }
}
