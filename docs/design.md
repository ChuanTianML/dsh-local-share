# DSH Share design

## Product behavior

DSH Share adds a Share utility to each Web Session header. The dialog renders a
local preview and produces either Markdown or one self-contained HTML file. The
browser can copy the generated source or download it. The plugin has no upload
endpoint and makes no outbound request.

The default export contains direct human prompts and visible assistant text in
log order. It excludes reasoning blocks, system prompts, request configuration,
raw stream chunks, plugin-injected context, attachment bytes, Session ids,
working-directory metadata, and replacement messages used only to reconstruct
model context. Image blocks become an explicit omission marker.

Tool calls are disabled by default. When enabled, each call is collapsed and
contains the tool name, bounded arguments, and success or failure state. Tool
result bodies are never exported. This exposes useful commands and patches
without copying arbitrary command output into the document.

## Privacy invariants

- Redaction starts enabled for every dialog opening.
- The Host applies redaction to the title, messages, tool names, and tool
  arguments before either output format is rendered.
- Redaction covers common credentials, authorization headers, secret-bearing
  environment assignments, email addresses, and absolute user paths.
- The preview uses a sandboxed `srcdoc` iframe with a restrictive content
  security policy and no scripts or external resources.
- Generated filenames contain only the product name and UTC date.
- Turning redaction off clears prior acknowledgement. Copy and download remain
  disabled until the user explicitly acknowledges the risk.

Redaction is heuristic and the dialog states that limitation. Preview is the
required final review surface.

## Architecture

The Host plugin depends on `sessionQuery` and `typert`. `DshShareRuntime`
implements the strict `dshShare/render` Remote. It reads one replay-validated,
live-preferred `SessionLogSnapshot`, checks the caller's cancellation state,
projects shareable entries, redacts them, and renders both the requested file
and a safe HTML preview. Read failures cross the wire as a generic message so
private backend paths are not disclosed.

The Web plugin mounts the same invocation descriptor, registers bilingual copy,
and contributes `dsh-share` to
`conversation.session.header.utilities`. React state owns dialog options and
aborts obsolete render requests. Copy uses the shared DSH clipboard primitive;
download uses a short-lived browser object URL.

The wire request is:

```ts
{
  sessionId: string
  format: 'markdown' | 'html'
  includeTools: boolean
  redact: boolean
}
```

The result contains the file name, media type, file content, safe preview HTML,
capture sequence, stable warning codes, and projection statistics. Zod codecs
reject unknown or malformed request and response fields.

## Deployment configuration

The Host validates all deployment-varying limits at load:

- `maxEvents`: maximum raw events accepted from one Session.
- `maxOutputChars`: maximum generated file or preview length.
- `maxToolArgumentChars`: maximum arguments retained for each enabled tool
  call.

Exceeding a Session or output limit fails visibly. Tool arguments alone may be
truncated; the document and statistics state that truncation.

## Compatibility and verification

Version 0.1.0 targets the DSH developer-preview API at Harness commit
`47f943859bef60e4160492346772ded9b24f765a`. DSH has no stable external plugin
compatibility promise yet, so this repository pins the verified commit in CI.

Unit tests cover projection, redaction, escaping, limits, wire codecs, browser
acknowledgement, stale request cancellation, copy, and download. Composition
tests mount the Host plugin over real Cordis and Typert services. Release
verification builds the committed Host and browser artifacts, installs the
bundle into an isolated Web profile, starts it on a non-default local port, and
checks the served plugin asset and Remote response path.

## Non-goals

DSH Share does not provide a hosted public URL, collaboration permissions,
editable replay data, complete diagnostic logs, attachment export, model tools,
or Feishu-specific publishing. The official Session log ZIP remains the right
format for diagnosis and migration.
