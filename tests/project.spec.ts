import { describe, expect, it } from 'vitest'
import { projectSession, redactDocument, selectTurns, summarizeTurns } from '../src/project.ts'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { fixtureMultiTurnSnapshot, fixtureSnapshot } from './fixtures.ts'

describe('Session share projection', () => {
  it('keeps direct prompts and visible assistant text only', () => {
    const projected = projectSession(fixtureSnapshot().events, false, 100)
    expect(projected.title).toContain('/Users/alice/project')
    expect(projected.turns).toHaveLength(1)
    expect(projected.turns[0]?.entries).toEqual([
      {
        kind: 'message',
        role: 'user',
        text: 'Use apiKey=sk-abcdefghijklmnop for alice@example.com.\n<img src="https://tracker.invalid/x">\n![pixel](https://tracker.invalid/pixel)\n\nImage omitted',
      },
      {
        kind: 'message',
        role: 'assistant',
        text: 'I will update `/Users/alice/project/app.ts`.',
      },
    ])
    expect(projected.stats).toEqual({
      turns: 1,
      messages: 2,
      toolCalls: 1,
      attachmentsOmitted: 1,
      injectedMessagesOmitted: 1,
      toolArgumentsTruncated: 0,
    })
    expect(JSON.stringify(projected)).not.toContain('PRIVATE CHAIN OF THOUGHT')
    expect(JSON.stringify(projected)).not.toContain('PRIVATE TOOL OUTPUT')
    expect(JSON.stringify(projected)).not.toContain('INTERNAL COMPACTION SUMMARY')
    expect(JSON.stringify(projected)).not.toContain('INTERNAL SYSTEM CONTEXT')
  })

  it('adds bounded tool arguments and an outcome only when requested', () => {
    const projected = projectSession(fixtureSnapshot().events, true, 24)
    expect(projected.turns[0]?.entries.at(-1)).toEqual({
      kind: 'tool',
      name: 'shell/bash',
      arguments: '{"cmd":"printf secret","\n… [truncated]',
      status: 'succeeded',
      truncated: true,
    })
    expect(projected.stats.toolArgumentsTruncated).toBe(1)
  })

  it('redacts every emitted field without mutating the source document', () => {
    const projected = projectSession(fixtureSnapshot().events, true, 1_000)
    const redacted = redactDocument(projected, true)
    expect(redacted.title).toBe('Private [REDACTED_PATH]')
    expect(JSON.stringify(redacted)).not.toContain('alice')
    expect(JSON.stringify(redacted)).not.toContain('sk-abcdefghijklmnop')
    expect(redacted.redactions).toBeGreaterThanOrEqual(4)
    expect(projected.title).toContain('/Users/alice/project')

    const unchanged = redactDocument(projected, false)
    expect(unchanged.redactions).toBe(0)
    expect(unchanged.title).toBe(projected.title)
  })

  it('distinguishes failed and unresolved tool outcomes without result bodies', () => {
    const snapshot = fixtureSnapshot()
    const events = structuredClone(snapshot.events) as SessionEvent[]
    const result = events.find(event => event.type === 'tool/result')
    if (result?.type !== 'tool/result') throw new Error('fixture tool result missing')
    result.data.error = { name: 'FixtureError', code: 'EXIT_7' }
    result.data.message.content[0].isError = true
    events.push({
      type: 'tool/call', seq: 7, time: 8,
      data: { turn: 1, step: 2, callId: 'orphan', name: 'orphan', arguments: '{}' },
    } as unknown as SessionEvent)

    const projected = projectSession(events, true, 1_000)
    expect(projected.turns.flatMap(turn => turn.entries).filter(entry => entry.kind === 'tool')).toEqual([
      {
        kind: 'tool', name: 'shell/bash',
        arguments: '{"cmd":"printf secret","cwd":"/Users/alice/project"}',
        status: 'failed', errorCode: 'EXIT_7', truncated: false,
      },
      {
        kind: 'tool', name: 'orphan', arguments: '{}',
        status: 'unknown', truncated: false,
      },
    ])
  })

  it('groups user-led turns and selects them in log order with recomputed counts', () => {
    const projected = projectSession(fixtureMultiTurnSnapshot().events, false, 1_000)
    expect(projected.turns.map(turn => turn.startSeq)).toEqual([1, 7])
    expect(projected.stats).toMatchObject({ turns: 2, messages: 4, toolCalls: 1 })
    expect(summarizeTurns(projected, true)).toEqual([
      expect.objectContaining({ startSeq: 1, preview: expect.not.stringContaining('sk-abcdefghijklmnop') }),
      expect.objectContaining({ startSeq: 7, preview: 'Second turn for [REDACTED_EMAIL].' }),
    ])

    const selected = selectTurns(projected, [7])
    expect(selected.turns.map(turn => turn.startSeq)).toEqual([7])
    expect(selected.stats).toEqual({
      turns: 1,
      messages: 2,
      toolCalls: 0,
      attachmentsOmitted: 0,
      injectedMessagesOmitted: 0,
      toolArgumentsTruncated: 0,
    })

    expect(selectTurns(projected, [7, 1]).turns.map(turn => turn.startSeq)).toEqual([1, 7])
  })
})
