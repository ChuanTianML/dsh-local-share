/** Markdown, self-contained HTML, and isolated preview rendering. */
import type { SessionLogSnapshot } from '@deepseek-ai/dsh-session-query'
import type { ShareRequest, ShareResult, ShareWarning } from './contract.ts'
import { projectSession, redactDocument } from './project.ts'
import type { RedactedShareDocument, ShareMessageEntry, ShareToolEntry } from './project.ts'

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

/** Disable authored raw HTML and image fetches while retaining ordinary Markdown. */
function safeMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^\r\n)]*\)/gu, (_match, alt: string) => `[Image omitted${alt.length === 0 ? '' : `: ${alt}`}]`)
    .replace(/!\[([^\]]*)\]\[[^\]]*\]/gu, (_match, alt: string) => `[Image omitted${alt.length === 0 ? '' : `: ${alt}`}]`)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
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
  const entries = document.entries.length === 0
    ? '_No shareable messages were found in this Session._'
    : document.entries.map(entry => entry.kind === 'message' ? markdownMessage(entry) : markdownTool(entry)).join('\n\n---\n\n')
  return [
    `# ${safeMarkdown(document.title)}`,
    '',
    `> Exported by DSH Local Share at ${generatedAt}.`,
    `> Privacy: ${privacyLine(request.redact)}`,
    `> Tools: ${request.includeTools ? 'names, bounded arguments, and outcomes included; result bodies excluded.' : 'excluded.'}`,
    '> Always excluded: reasoning, system prompts, injected context, attachment bytes, Session identifiers, and working-directory metadata.',
    '',
    entries,
    '',
  ].join('\n')
}

function htmlMessage(entry: ShareMessageEntry): string {
  const role = entry.role === 'user' ? 'User' : 'Assistant'
  return `<section class="message ${entry.role}"><h2>${role}</h2><div class="body">${escapeHtml(entry.text)}</div></section>`
}

function htmlTool(entry: ShareToolEntry): string {
  return `<details class="tool"><summary><strong>Tool</strong> · ${escapeHtml(entry.name)} · ${escapeHtml(statusLabel(entry))}</summary><pre>${escapeHtml(entry.arguments)}</pre></details>`
}

/** Render script-free HTML used both as a file and as sandboxed preview. */
function renderHtml(document: RedactedShareDocument, request: ShareRequest, generatedAt: string): string {
  const entries = document.entries.length === 0
    ? '<p class="empty">No shareable messages were found in this Session.</p>'
    : document.entries.map(entry => entry.kind === 'message' ? htmlMessage(entry) : htmlTool(entry)).join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(document.title)}</title>
<style>
:root{color-scheme:light dark;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f7f7f5;color:#202124}*{box-sizing:border-box}body{margin:0;padding:36px 18px}.page{max-width:860px;margin:auto}.meta,.message,.tool,.empty{background:#fff;border:1px solid #deded8;border-radius:14px;padding:18px 20px;margin:0 0 16px;box-shadow:0 1px 2px #00000008}h1{font-size:28px;margin:0 0 16px}h2{font-size:13px;letter-spacing:.05em;text-transform:uppercase;margin:0 0 12px;color:#666}.meta{font-size:13px;line-height:1.55;color:#555}.meta p{margin:4px 0}.body,pre{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65}.user{border-left:4px solid #4d7cfe}.assistant{border-left:4px solid #29a36a}.tool summary{cursor:pointer}.tool pre{margin:14px 0 0;padding:14px;background:#f3f3ef;border-radius:9px;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}@media(prefers-color-scheme:dark){:root{background:#171817;color:#eceeeb}.meta,.message,.tool,.empty{background:#222321;border-color:#3a3b38}.meta,h2{color:#b7b9b4}.tool pre{background:#181916}}
</style>
</head>
<body><main class="page">
<h1>${escapeHtml(document.title)}</h1>
<section class="meta"><p>Exported by DSH Local Share at ${escapeHtml(generatedAt)}.</p><p><strong>Privacy:</strong> ${escapeHtml(privacyLine(request.redact))}</p><p><strong>Tools:</strong> ${request.includeTools ? 'Names, bounded arguments, and outcomes included; result bodies excluded.' : 'Excluded.'}</p><p>Always excluded: reasoning, system prompts, injected context, attachment bytes, Session identifiers, and working-directory metadata.</p></section>
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
  const document = redactDocument(projected, request.redact)
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
    warnings: warningCodes(document, request),
    stats: {
      ...document.stats,
      redactions: document.redactions,
    },
  }
}
