/** Markdown, self-contained HTML, and isolated preview rendering. */
import type { SessionLogSnapshot } from '@deepseek-ai/dsh-session-query'
import type { Nodes } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { micromark } from 'micromark'
import { gfm, gfmHtml } from 'micromark-extension-gfm'
import type { ShareRequest, ShareResult, ShareWarning } from './contract.ts'
import { projectSession, redactDocument, selectTurns, summarizeTurns } from './project.ts'
import type { RedactedShareDocument, ShareMessageEntry, ShareToolEntry } from './project.ts'

const GFM_EXTENSION = gfm()
const GFM_HTML_EXTENSION = gfmHtml()

/** Validated Host-side resource limits. */
export interface ShareLimits {
  maxEvents: number
  maxOutputChars: number
  maxToolArgumentChars: number
}

/** Safe, user-visible failure caused by an explicit export limit. */
export class ShareRenderError extends Error {
  override readonly name = 'ShareRenderError'
}

/** Escape text for an HTML text node. */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

interface MarkdownReplacement {
  start: number
  end: number
  text: string
}

function imageOmissionText(alt: string | null | undefined): string {
  const label = (alt ?? '')
    .replace(/[\t\n\r ]+/gu, ' ')
    .trim()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('!', '！')
    .replaceAll('[', '［')
    .replaceAll(']', '］')
  return `Image omitted${label.length === 0 ? '' : `: ${label}`}`
}

function collectImageReplacements(node: Nodes, replacements: MarkdownReplacement[]): void {
  if (node.type === 'image' || node.type === 'imageReference') {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start !== undefined && end !== undefined) {
      replacements.push({ start, end, text: imageOmissionText(node.alt) })
    }
    return
  }
  if ('children' in node) {
    for (const child of node.children) collectImageReplacements(child, replacements)
  }
}

/** Replace every parsed Markdown image with a local omission marker. */
function omitMarkdownImages(value: string): string {
  const tree = fromMarkdown(value, {
    extensions: [GFM_EXTENSION],
    mdastExtensions: [gfmFromMarkdown()],
  })
  const replacements: MarkdownReplacement[] = []
  collectImageReplacements(tree, replacements)
  return replacements
    .sort((left, right) => right.start - left.start)
    .reduce((output, replacement) => (
      `${output.slice(0, replacement.start)}${replacement.text}${output.slice(replacement.end)}`
    ), value)
}

/** Disable authored raw HTML while retaining ordinary Markdown. */
function safeMarkdown(value: string): string {
  return value.replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function safeLinkHtml(html: string): string {
  return html.replace(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gu,
    (_match, attributes: string, body: string) => {
      const href = /\bhref="([^"]*)"/u.exec(attributes)?.[1]
      const title = /\btitle="([^"]*)"/u.exec(attributes)?.[1]
      if (href === undefined) return `<span class="link-disabled">${body}</span>`
      if (!/^(?:https?:\/\/|mailto:)/iu.test(href)) return `<span class="link-disabled">${body}</span>`
      const titleAttribute = title === undefined ? '' : ` title="${title}"`
      const externalAttributes = /^https?:\/\//iu.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${href}"${titleAttribute}${externalAttributes}>${body}</a>`
    },
  )
}

/** Render assistant Markdown to static HTML without active authored markup or resources. */
function safeMarkdownHtml(value: string): string {
  const html = micromark(omitMarkdownImages(value), {
    extensions: [GFM_EXTENSION],
    htmlExtensions: [GFM_HTML_EXTENSION],
  })
    .replace(/<img\b[^>]*>/gu, '<span class="image-omitted">Image omitted</span>')
  return safeLinkHtml(html)
}

/** Choose a fence longer than every backtick run in untrusted content. */
function fenceFor(value: string): string {
  const longest = Math.max(0, ...Array.from(value.matchAll(/`+/gu), match => match[0].length))
  return '`'.repeat(Math.max(3, longest + 1))
}

function statusLabel(entry: ShareToolEntry): string {
  switch (entry.status) {
    case 'succeeded': return 'Succeeded'
    case 'failed': return entry.errorCode === undefined ? 'Failed' : `Failed (${entry.errorCode})`
    case 'unknown': return 'Outcome unavailable'
  }
}

function privacyLine(redact: boolean): string {
  return redact
    ? 'Best-effort redaction enabled. Review this document before sharing.'
    : 'Redaction disabled. This document may contain private data or credentials.'
}

function markdownMessage(entry: ShareMessageEntry): string {
  const role = entry.role === 'user' ? 'User' : 'Assistant'
  return `## ${role}\n\n${safeMarkdown(entry.text)}`
}

function markdownTool(entry: ShareToolEntry): string {
  const args = safeMarkdown(entry.arguments)
  const fence = fenceFor(args)
  return [
    '<details>',
    `<summary><strong>Tool</strong> · ${escapeHtml(entry.name)} · ${escapeHtml(statusLabel(entry))}</summary>`,
    '',
    `${fence}json`,
    args,
    fence,
    '',
    '</details>',
  ].join('\n')
}

/** Render the portable Markdown file. */
function renderMarkdown(document: RedactedShareDocument, request: ShareRequest, generatedAt: string): string {
  const projectedEntries = document.turns.flatMap(turn => turn.entries)
  const entries = projectedEntries.length === 0
    ? '_No shareable messages were found in this Session._'
    : projectedEntries.map(entry => entry.kind === 'message' ? markdownMessage(entry) : markdownTool(entry)).join('\n\n---\n\n')
  return omitMarkdownImages([
    `# ${safeMarkdown(document.title)}`,
    '',
    `> Exported by DSH Local Share at ${generatedAt}.`,
    `> Privacy: ${privacyLine(request.redact)}`,
    `> Tools: ${request.includeTools ? 'names, bounded arguments, and outcomes included; result bodies excluded.' : 'excluded.'}`,
    '> Always excluded: reasoning, system prompts, injected context, attachment bytes, Session identifiers, and working-directory metadata.',
    '',
    entries,
    '',
  ].join('\n'))
}

function htmlMessage(entry: ShareMessageEntry): string {
  const role = entry.role === 'user' ? 'User' : 'Assistant'
  const body = entry.role === 'assistant'
    ? `<div class="body markdown-body">${safeMarkdownHtml(entry.text)}</div>`
    : `<div class="body user-body">${escapeHtml(entry.text)}</div>`
  return `<article class="message ${entry.role}"><header class="message-header"><span class="role-dot" aria-hidden="true"></span><h2>${role}</h2></header>${body}</article>`
}

function htmlTool(entry: ShareToolEntry): string {
  return `<details class="tool"><summary><span class="tool-label">Tool</span><strong>${escapeHtml(entry.name)}</strong><span class="tool-status">${escapeHtml(statusLabel(entry))}</span></summary><pre>${escapeHtml(entry.arguments)}</pre></details>`
}

/** Render script-free HTML used both as a file and as sandboxed preview. */
function renderHtml(document: RedactedShareDocument, request: ShareRequest, generatedAt: string): string {
  const projectedEntries = document.turns.flatMap(turn => turn.entries)
  const entries = projectedEntries.length === 0
    ? '<p class="empty">No shareable messages were found in this Session.</p>'
    : projectedEntries.map(entry => entry.kind === 'message' ? htmlMessage(entry) : htmlTool(entry)).join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(document.title)}</title>
<style>
:root{color-scheme:light dark;--canvas:#f5f5f7;--surface:#fff;--surface-user:#f2f7ff;--ink:#1d1d1f;--muted:#6e6e73;--faint:#86868b;--line:rgba(0,0,0,.08);--line-strong:rgba(0,0,0,.12);--accent:#0071e3;--assistant:#248a5b;--code:#f5f5f7;--code-block:#1d1d1f;--code-ink:#f5f5f7;--shadow:0 1px 2px rgba(0,0,0,.03),0 14px 42px rgba(0,0,0,.055);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Helvetica Neue",Arial,sans-serif;background:var(--canvas);color:var(--ink);font-synthesis:none;-webkit-font-smoothing:antialiased}*{box-sizing:border-box}html{background:var(--canvas)}body{margin:0;min-height:100vh;padding:64px 24px 88px;background:var(--canvas)}.page{width:min(920px,100%);margin:0 auto}.document-header{padding:0 8px;margin:0 0 28px}.eyebrow{margin:0 0 14px;color:var(--faint);font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}.document-title{max-width:760px;margin:0;font-size:clamp(32px,5vw,46px);font-weight:650;letter-spacing:-.035em;line-height:1.08;overflow-wrap:anywhere}.meta{display:grid;grid-template-columns:1fr;gap:0;margin:0 0 28px;padding:0 22px;background:rgba(255,255,255,.72);border:1px solid var(--line);border-radius:20px;box-shadow:0 1px 2px rgba(0,0,0,.025);backdrop-filter:saturate(180%) blur(18px)}.meta-row{display:grid;grid-template-columns:112px 1fr;gap:20px;padding:15px 0;border-bottom:1px solid var(--line);font-size:13px;line-height:1.55}.meta-row:last-child{border-bottom:0}.meta-label{color:var(--muted);font-weight:600}.meta-value{color:var(--ink)}.message,.tool,.empty{margin:0 0 18px;border:1px solid var(--line);border-radius:24px;background:var(--surface);box-shadow:var(--shadow)}.message{padding:24px 26px}.message.user{background:var(--surface-user);box-shadow:0 1px 2px rgba(0,74,173,.025),0 12px 36px rgba(0,74,173,.04)}.message-header{display:flex;align-items:center;gap:9px;margin:0 0 18px}.message-header h2{margin:0;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.115em;text-transform:uppercase}.role-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px rgba(0,113,227,.1)}.assistant .role-dot{background:var(--assistant);box-shadow:0 0 0 4px rgba(36,138,91,.1)}.body{min-width:0;color:var(--ink);font-size:16px;line-height:1.72;overflow-wrap:anywhere}.user-body{white-space:pre-wrap}.markdown-body>:first-child{margin-top:0}.markdown-body>:last-child{margin-bottom:0}.markdown-body p{margin:0 0 1em}.markdown-body h1,.markdown-body h2,.markdown-body h3,.markdown-body h4,.markdown-body h5,.markdown-body h6{margin:1.6em 0 .6em;color:var(--ink);font-weight:650;letter-spacing:-.018em;line-height:1.25}.markdown-body h1{font-size:1.7em}.markdown-body h2{font-size:1.42em}.markdown-body h3{font-size:1.18em}.markdown-body h4,.markdown-body h5,.markdown-body h6{font-size:1em;letter-spacing:0}.markdown-body ul,.markdown-body ol{margin:.4em 0 1.05em;padding-left:1.55em}.markdown-body li{padding-left:.18em;margin:.26em 0}.markdown-body li>p{margin:.3em 0}.markdown-body blockquote{margin:1.2em 0;padding:.05em 0 .05em 1.05em;border-left:3px solid var(--line-strong);color:var(--muted)}.markdown-body hr{height:1px;margin:1.7em 0;border:0;background:var(--line)}.markdown-body code,.tool code{padding:.16em .42em;border:1px solid var(--line);border-radius:6px;background:var(--code);font:85%/1.5 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}.markdown-body pre,.tool pre{margin:1.15em 0;padding:18px 19px;border-radius:15px;background:var(--code-block);color:var(--code-ink);overflow:auto;white-space:pre;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);font:13px/1.65 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}.markdown-body pre code{padding:0;border:0;background:transparent;color:inherit;font:inherit}.markdown-body a{color:var(--accent);text-decoration:none}.markdown-body a:hover{text-decoration:underline}.link-disabled{color:var(--muted);text-decoration:underline;text-decoration-style:dotted}.image-omitted{display:inline-flex;padding:.22em .58em;border:1px solid var(--line-strong);border-radius:999px;color:var(--muted);background:var(--code);font-size:.82em;line-height:1.4}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.markdown-body table{display:block;width:100%;margin:1.2em 0;border-spacing:0;border-collapse:separate;border:1px solid var(--line);border-radius:12px;overflow:auto}.markdown-body th,.markdown-body td{padding:10px 13px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.markdown-body th{background:var(--code);font-size:.88em;font-weight:650}.markdown-body tr:last-child td{border-bottom:0}.markdown-body th:last-child,.markdown-body td:last-child{border-right:0}.markdown-body input[type=checkbox]{margin:0 .45em 0 0;accent-color:var(--accent)}.tool{padding:0 22px}.tool summary{display:flex;align-items:center;gap:10px;padding:18px 0;cursor:pointer;list-style:none;font-size:13px}.tool summary::-webkit-details-marker{display:none}.tool summary:after{content:"+";margin-left:auto;color:var(--faint);font-size:18px;font-weight:300}.tool[open] summary:after{content:"−"}.tool-label,.tool-status{color:var(--muted)}.tool-label{padding:4px 8px;border-radius:999px;background:var(--code);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.tool pre{margin:0 0 20px}.empty{padding:32px;color:var(--muted);text-align:center}@media(prefers-color-scheme:dark){:root{--canvas:#101011;--surface:#1c1c1e;--surface-user:#172231;--ink:#f5f5f7;--muted:#a1a1a6;--faint:#8e8e93;--line:rgba(255,255,255,.1);--line-strong:rgba(255,255,255,.16);--accent:#2997ff;--assistant:#3fc380;--code:#29292c;--code-block:#09090a;--code-ink:#f5f5f7;--shadow:0 1px 2px rgba(0,0,0,.18),0 18px 48px rgba(0,0,0,.22)}.meta{background:rgba(28,28,30,.78)}.message.user{box-shadow:var(--shadow)}}@media(max-width:620px){body{padding:38px 14px 60px}.document-header{padding:0 5px}.document-title{font-size:32px}.meta{padding:0 17px;border-radius:18px}.meta-row{grid-template-columns:1fr;gap:4px;padding:13px 0}.message{padding:21px 19px;border-radius:20px}.body{font-size:15px}.markdown-body pre{margin-left:-7px;margin-right:-7px}.tool{padding:0 18px}}@media print{:root{color-scheme:light;--canvas:#fff;--surface:#fff;--surface-user:#f2f7ff;--ink:#1d1d1f;--muted:#6e6e73;--faint:#86868b;--line:rgba(0,0,0,.08);--line-strong:rgba(0,0,0,.12);--code:#f5f5f7;--code-block:#f5f5f7;--code-ink:#1d1d1f;--shadow:none}body{padding:0;background:#fff}.page{width:100%}.meta,.message,.tool,.empty{break-inside:avoid;box-shadow:none}.document-title{font-size:34px}.markdown-body a{color:inherit;text-decoration:underline}}
</style>
</head>
<body><main class="page">
<header class="document-header"><p class="eyebrow">DSH Local Share</p><h1 class="document-title">${escapeHtml(document.title)}</h1></header>
<section class="meta" aria-label="Export details"><div class="meta-row"><span class="meta-label">Generated</span><span class="meta-value">${escapeHtml(generatedAt)}</span></div><div class="meta-row"><span class="meta-label">Privacy</span><span class="meta-value">${escapeHtml(privacyLine(request.redact))}</span></div><div class="meta-row"><span class="meta-label">Tools</span><span class="meta-value">${request.includeTools ? 'Names, bounded arguments, and outcomes included; result bodies excluded.' : 'Excluded.'}</span></div><div class="meta-row"><span class="meta-label">Always private</span><span class="meta-value">Reasoning, system prompts, injected context, attachment bytes, Session identifiers, and working-directory metadata.</span></div></section>
${entries}
</main></body>
</html>
`
}

function warningCodes(document: RedactedShareDocument, request: ShareRequest): ShareWarning[] {
  const warnings: ShareWarning[] = [request.redact ? 'redaction-best-effort' : 'unredacted']
  if (document.stats.attachmentsOmitted > 0) warnings.push('attachments-omitted')
  if (document.stats.injectedMessagesOmitted > 0) warnings.push('injected-context-omitted')
  if (!request.includeTools && document.stats.toolCalls > 0) warnings.push('tools-omitted')
  if (document.stats.toolArgumentsTruncated > 0) warnings.push('tool-arguments-truncated')
  return warnings
}

/**
 * Render one atomic Session observation into a local file and safe preview.
 * @param snapshot - complete replay-validated Session observation.
 * @param request - format and privacy options.
 * @param limits - validated Host resource limits.
 * @param now - generation time, injectable for deterministic tests.
 * @returns strict Remote result.
 */
export function renderShare(
  snapshot: SessionLogSnapshot,
  request: ShareRequest,
  limits: ShareLimits,
  now: Date = new Date(),
): ShareResult {
  if (snapshot.events.length > limits.maxEvents) {
    throw new ShareRenderError(`dsh-local-share: this Session has more than ${limits.maxEvents} events; raise maxEvents to export it`)
  }
  const projected = projectSession(snapshot.events, request.includeTools, limits.maxToolArgumentChars)
  const availableTurnSeqs = new Set(projected.turns.map(turn => turn.startSeq))
  if (request.selectedTurnSeqs?.some(seq => !availableTurnSeqs.has(seq)) === true) {
    throw new ShareRenderError('dsh-local-share: the selected turn is no longer available; reopen Share and try again')
  }
  const selected = selectTurns(projected, request.selectedTurnSeqs)
  const document = redactDocument(selected, request.redact)
  const generatedAt = now.toISOString()
  const markdown = request.format === 'markdown' ? renderMarkdown(document, request, generatedAt) : undefined
  const html = renderHtml(document, request, generatedAt)
  const content = markdown ?? html
  if (content.length > limits.maxOutputChars || html.length > limits.maxOutputChars) {
    throw new ShareRenderError(`dsh-local-share: generated output exceeds ${limits.maxOutputChars} characters; raise maxOutputChars to export it`)
  }
  const date = generatedAt.slice(0, 10)
  const markdownFormat = request.format === 'markdown'
  return {
    filename: `dsh-local-share-${date}.${markdownFormat ? 'md' : 'html'}`,
    mimeType: markdownFormat ? 'text/markdown;charset=utf-8' : 'text/html;charset=utf-8',
    content,
    previewHtml: html,
    generatedAt,
    capturedThroughSeq: snapshot.events.at(-1)?.seq ?? null,
    turns: summarizeTurns(projected, request.redact),
    warnings: warningCodes(document, request),
    stats: {
      ...document.stats,
      redactions: document.redactions,
    },
  }
}
