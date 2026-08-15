import { describe, expect, it } from 'vitest'
import { renderShare, ShareRenderError, type ShareLimits } from '../src/render.ts'
import { fixtureSnapshot } from './fixtures.ts'

const LIMITS: ShareLimits = {
  maxEvents: 100,
  maxOutputChars: 100_000,
  maxToolArgumentChars: 1_000,
}
const NOW = new Date('2026-08-14T12:34:56.000Z')

describe('share rendering', () => {
  it('renders privacy-first Markdown with no private Session metadata or active image', () => {
    const result = renderShare(fixtureSnapshot(), {
      sessionId: 'session-private-id', format: 'markdown', includeTools: false, redact: true,
    }, LIMITS, NOW)
    expect(result.filename).toBe('dsh-local-share-2026-08-14.md')
    expect(result.mimeType).toBe('text/markdown;charset=utf-8')
    expect(result.capturedThroughSeq).toBe(6)
    expect(result.content).toContain('# Private [REDACTED_PATH]')
    expect(result.content).toContain('&lt;img src="https://tracker.invalid/x"&gt;')
    expect(result.content).toContain('[Image omitted: pixel]')
    expect(result.content).not.toContain('![pixel]')
    expect(result.content).not.toContain('session-private-id')
    expect(result.content).not.toContain('/Users/alice')
    expect(result.content).not.toContain('PRIVATE CHAIN OF THOUGHT')
    expect(result.content).not.toContain('PRIVATE TOOL OUTPUT')
    expect(result.warnings).toEqual([
      'redaction-best-effort',
      'attachments-omitted',
      'injected-context-omitted',
      'tools-omitted',
    ])
    expect(result.stats).toMatchObject({ messages: 2, toolCalls: 1, redactions: 4 })
  })

  it('renders script-free self-contained HTML and safely escapes authored markup', () => {
    const result = renderShare(fixtureSnapshot(), {
      sessionId: 's1', format: 'html', includeTools: true, redact: true,
    }, LIMITS, NOW)
    expect(result.filename).toBe('dsh-local-share-2026-08-14.html')
    expect(result.content).toBe(result.previewHtml)
    expect(result.content).toContain("default-src 'none'")
    expect(result.content).toContain('&lt;img src=&quot;https://tracker.invalid/x&quot;&gt;')
    expect(result.content).toContain('<details class="tool">')
    expect(result.content).toContain('[REDACTED_PATH]')
    expect(result.content).not.toContain('<script')
    expect(result.content).not.toContain('/Users/alice')
    expect(result.content).not.toContain('PRIVATE TOOL OUTPUT')
  })

  it('retains private text only after redaction is explicitly disabled', () => {
    const result = renderShare(fixtureSnapshot(), {
      sessionId: 's1', format: 'markdown', includeTools: true, redact: false,
    }, LIMITS, NOW)
    expect(result.content).toContain('sk-abcdefghijklmnop')
    expect(result.content).toContain('/Users/alice/project')
    expect(result.warnings[0]).toBe('unredacted')
    expect(result.stats.redactions).toBe(0)
  })

  it('fails visibly when the Session or generated output exceeds a limit', () => {
    expect(() => renderShare(fixtureSnapshot(), {
      sessionId: 's1', format: 'markdown', includeTools: false, redact: true,
    }, { ...LIMITS, maxEvents: 1 }, NOW)).toThrow(ShareRenderError)
    expect(() => renderShare(fixtureSnapshot(), {
      sessionId: 's1', format: 'markdown', includeTools: false, redact: true,
    }, { ...LIMITS, maxOutputChars: 10 }, NOW)).toThrow(/generated output exceeds 10/)
  })

  it('renders an explicit empty state and null capture sequence', () => {
    const snapshot = fixtureSnapshot()
    const result = renderShare({ ...snapshot, events: [] }, {
      sessionId: 's1', format: 'markdown', includeTools: false, redact: true,
    }, LIMITS, NOW)
    expect(result.content).toContain('No shareable messages')
    expect(result.capturedThroughSeq).toBeNull()
    expect(result.stats.messages).toBe(0)
  })

  it('neutralizes reference images and reports bounded tool arguments', () => {
    const snapshot = fixtureSnapshot()
    const user = snapshot.events.find(event => event.type === 'user/message' && event.data.source.kind === 'user')
    if (user?.type !== 'user/message' || user.data.content[0]?.type !== 'text') {
      throw new Error('fixture user text missing')
    }
    user.data.content[0].text += '\n![reference][pixel]\n![](https://tracker.invalid/empty)'
    const result = renderShare(snapshot, {
      sessionId: 's1', format: 'markdown', includeTools: true, redact: true,
    }, { ...LIMITS, maxToolArgumentChars: 5 }, NOW)
    expect(result.content).toContain('[Image omitted: reference]')
    expect(result.content).toContain('[Image omitted]')
    expect(result.content).toContain('… [truncated]')
    expect(result.warnings).toContain('tool-arguments-truncated')
  })
})
