import { describe, expect, it } from 'vitest'
import { micromark } from 'micromark'
import { gfm, gfmHtml } from 'micromark-extension-gfm'
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
    expect(result.content).toContain('Image omitted: pixel')
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

  it('renders assistant GFM as safe, polished semantic HTML while preserving user text', () => {
    const snapshot = fixtureSnapshot()
    const user = snapshot.events.find(event => event.type === 'user/message' && event.data.source.kind === 'user')
    const assistant = snapshot.events.find(event => event.type === 'assistant/message' && event.surfaceOp === 'append')
    if (user?.type !== 'user/message' || user.data.content[0]?.type !== 'text') {
      throw new Error('fixture user text missing')
    }
    if (assistant?.type !== 'assistant/message' || assistant.data.message.content[1]?.type !== 'text') {
      throw new Error('fixture assistant text missing')
    }
    user.data.content[0].text = 'Keep **this user syntax** literal.'
    assistant.data.message.content[1].text = [
      '# Result',
      '',
      '- **Done** with `inline code`',
      '- ~~Removed~~',
      '',
      '> A concise note.',
      '',
      'A footnote[^1].',
      '',
      '[^1]: Local note.',
      '',
      '| Item | State |',
      '| --- | --- |',
      '| Preview | Ready |',
      '',
      '```ts',
      'const safe = "<script>"',
      '```',
      '',
      '[Open](https://example.com/docs) [Mail](mailto:test@example.com)',
      '[Blocked](javascript:alert(1)) [Local](/private)',
      '',
      '![tracker](https://tracker.invalid/pixel)',
      '![reference][asset]',
      '![shortcut]',
      '',
      '[asset]: https://tracker.invalid/reference',
      '[shortcut]: https://tracker.invalid/shortcut',
      '',
      '<script>alert("no")</script>',
    ].join('\n')

    const result = renderShare(snapshot, {
      sessionId: 's1', format: 'html', includeTools: false, redact: false,
    }, LIMITS, NOW)

    expect(result.content).toContain('<div class="body user-body">Keep **this user syntax** literal.')
    expect(result.content).toContain('<h1>Result</h1>')
    expect(result.content).toContain('<strong>Done</strong>')
    expect(result.content).toContain('<del>Removed</del>')
    expect(result.content).toContain('<blockquote>')
    expect(result.content).toContain('data-footnotes=""')
    expect(result.content).not.toContain('href="#')
    expect(result.content).toContain('<table>')
    expect(result.content).toContain('<pre><code class="language-ts">')
    expect(result.content).toContain('href="https://example.com/docs" target="_blank" rel="noopener noreferrer"')
    expect(result.content).toContain('href="mailto:test@example.com"')
    expect(result.content).toContain('<span class="link-disabled">Blocked</span>')
    expect(result.content).toContain('<span class="link-disabled">Local</span>')
    expect(result.content).toContain('Image omitted: tracker')
    expect(result.content).toContain('Image omitted: reference')
    expect(result.content).toContain('Image omitted: shortcut')
    expect(result.content).toContain('&lt;script&gt;alert(&quot;no&quot;)&lt;/script&gt;')
    expect(result.content).not.toContain('<img ')
    expect(result.content).not.toContain('tracker.invalid')
    expect(result.content).toContain('--canvas:#f5f5f7')
    expect(result.content).toContain('@media print')
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
    user.data.content[0].text += [
      '',
      '![reference][pixel]',
      '![](https://tracker.invalid/empty)',
      '![shortcut]',
      '',
      '[pixel]: https://tracker.invalid/reference',
      '[shortcut]: https://tracker.invalid/shortcut',
    ].join('\n')
    const result = renderShare(snapshot, {
      sessionId: 's1', format: 'markdown', includeTools: true, redact: true,
    }, { ...LIMITS, maxToolArgumentChars: 5 }, NOW)
    expect(result.content).toContain('Image omitted: reference')
    expect(result.content).toContain('Image omitted')
    expect(result.content).toContain('Image omitted: shortcut')
    expect(result.content).not.toContain('![shortcut]')
    expect(result.content).toContain('… [truncated]')
    expect(result.warnings).toContain('tool-arguments-truncated')
  })

  it('neutralizes multiline shortcut reference images in Markdown and HTML', () => {
    const snapshot = fixtureSnapshot()
    const assistant = snapshot.events.find(event => event.type === 'assistant/message' && event.surfaceOp === 'append')
    if (assistant?.type !== 'assistant/message' || assistant.data.message.content[1]?.type !== 'text') {
      throw new Error('fixture assistant text missing')
    }
    const user = snapshot.events.find(event => event.type === 'user/message' && event.data.source.kind === 'user')
    if (user?.type !== 'user/message' || user.data.content[0]?.type !== 'text') {
      throw new Error('fixture user text missing')
    }
    user.data.content[0].text = 'No images here.'
    assistant.data.message.content[1].text = [
      '![line one',
      'line two]',
      '',
      '[line one line two]: https://tracker.invalid/pixel',
    ].join('\n')

    const markdown = renderShare(snapshot, {
      sessionId: 's1', format: 'markdown', includeTools: false, redact: false,
    }, LIMITS, NOW)
    const html = renderShare(snapshot, {
      sessionId: 's1', format: 'html', includeTools: false, redact: false,
    }, LIMITS, NOW)

    expect(markdown.content).toContain('Image omitted: line one line two')
    expect(markdown.content).not.toContain('![line one')
    expect(html.content).not.toContain('<img')
    expect(html.content).not.toContain('tracker.invalid')
  })

  it('does not let omission text or decoded alt content reactivate Markdown', () => {
    const snapshot = fixtureSnapshot()
    const user = snapshot.events.find(event => event.type === 'user/message' && event.data.source.kind === 'user')
    const assistant = snapshot.events.find(event => event.type === 'assistant/message' && event.surfaceOp === 'append')
    if (user?.type !== 'user/message' || user.data.content[0]?.type !== 'text') {
      throw new Error('fixture user text missing')
    }
    if (assistant?.type !== 'assistant/message' || assistant.data.message.content[1]?.type !== 'text') {
      throw new Error('fixture assistant text missing')
    }
    user.data.content[0].text = '[Image omitted: x]: https://tracker.invalid/rearmed'
    assistant.data.message.content[1].text = [
      '!![x]',
      '',
      '[x]: https://origin.invalid/x',
      '',
      '![<img src=x onerror=alert(1)>](https://origin.invalid/alt)',
    ].join('\n')

    const result = renderShare(snapshot, {
      sessionId: 's1', format: 'markdown', includeTools: false, redact: false,
    }, LIMITS, NOW)
    const reparsed = micromark(result.content, {
      extensions: [gfm()],
      htmlExtensions: [gfmHtml()],
    })

    expect(result.content).toContain('Image omitted: &lt;img src=x onerror=alert(1)&gt;')
    expect(result.content).not.toContain('<img src=x')
    expect(reparsed).not.toContain('<img')
    expect(reparsed).not.toContain('tracker.invalid/rearmed')
  })
})
