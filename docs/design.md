# DSH Local Share design

## Product behavior

DSH Local Share adds a Share utility to each Web Session header. The dialog renders a
local preview and produces Markdown, one self-contained HTML file, or one long
PNG. The browser can copy or download the result. The plugin has no upload
endpoint and makes no outbound request.

The default export contains direct human prompts and visible assistant text in
log order. It excludes reasoning blocks, system prompts, request configuration,
raw stream chunks, plugin-injected context, attachment bytes, Session ids,
working-directory metadata, and replacement messages used only to reconstruct
model context. Image blocks become an explicit omission marker. A direct human
prompt starts a turn that retains following visible assistant and optional tool
activity until the next direct prompt. The user may export all turns or any
non-empty subset; selected turns keep log order.

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
- Long PNG generation temporarily gives that script-free preview a same-origin
  sandbox capability so the parent can rasterize it. Conservative edge and
  pixel budgets reject images that exceed reliable browser canvas limits.
- Generated filenames contain only the product name and UTC date.
- Turning redaction off clears prior acknowledgement. Copy and download remain
  disabled until the user explicitly acknowledges the risk.

Redaction is heuristic and the dialog states that limitation. Preview is the
required final review surface.

## Architecture

The Host plugin depends on `sessionQuery` and `typert`. `DshShareRuntime`
implements the strict `dshLocalShare/render` Remote. It reads one replay-validated,
live-preferred `SessionLogSnapshot`, checks the caller's cancellation state,
projects shareable entries, redacts them, and renders both the requested file
and a safe HTML preview. Read failures cross the wire as a generic message so
private backend paths are not disclosed.

The Web plugin mounts the same invocation descriptor, registers bilingual copy,
and contributes `dsh-local-share` to
`conversation.session.header.utilities`. React state owns dialog options and
aborts obsolete render requests. Copy uses the shared DSH clipboard primitive;
download uses a short-lived browser object URL.

Turn selector metadata contains only a turn start sequence, bounded visible-text
preview, and counts. The preview text passes through the same redaction mode as
the document. PNG output is derived in the browser from the already-rendered
safe HTML document with `html-to-image`; generated pixels are copied or placed
in a short-lived download Blob and are never sent to the Host or a third party.

The preview keeps one fixed-height shell mounted while options regenerate. An
immediately opaque local loading layer covers iframe navigation until the
current request generation has loaded and painted one animation frame. Every
generation gets a new iframe, while copy and download remain keyed to the
current request.
The risk acknowledgement and safe-state note share one layout slot, so changing
redaction does not move the preview. Reopening resets the internal scroll
position after the initial iframe load.

Visible assistant text is parsed as GFM after redaction and emitted as static
semantic HTML. Authored raw HTML is escaped, Markdown images become omission
markers, external HTTP(S) links receive safe new-window attributes, and unsafe
or local destinations are inert. Human prompts remain literal. The generated
HTML uses only inline fixed CSS, supports light, dark, print, and narrow-screen
presentation, and declares a Content Security Policy that blocks scripts,
images, fonts, frames, media, forms, objects, and connections.

The wire request is:

```ts
{
  sessionId: string
  format: 'markdown' | 'html'
  includeTools: boolean
  redact: boolean
  selectedTurnSeqs: number[] | null
}
```

`null` selects all turns; an array must be non-empty and contain unique turn
starts. The result contains the file name, media type, file content, safe
preview HTML, capture sequence, redaction-matched metadata for every available
turn, stable warning codes, and selected projection statistics. Zod codecs
reject unknown or malformed request and response fields. The Host also rejects
a selected turn that disappeared before rendering.

## Deployment configuration

The Host validates all deployment-varying limits at load:

- `maxEvents`: maximum raw events accepted from one Session.
- `maxOutputChars`: maximum generated file or preview length.
- `maxToolArgumentChars`: maximum arguments retained for each enabled tool
  call.

Exceeding a Session or output limit fails visibly. Tool arguments alone may be
truncated; the document and statistics state that truncation.

## Compatibility and verification

Version 0.4.1 targets the DSH developer-preview API at Harness commit
`47f943859bef60e4160492346772ded9b24f765a`. DSH has no stable external plugin
compatibility promise yet, so this repository pins the verified commit in CI.

Unit tests cover projection, redaction, safe GFM rendering, limits, wire codecs,
stable preview loading, browser acknowledgement, stale request cancellation,
scroll restoration, turn selection, long-image limits, image clipboard behavior,
copy, and download. Composition
tests mount the Host plugin over real Cordis and Typert services. Release
verification builds the committed Host and browser artifacts, installs the
bundle into an isolated Web profile, starts it on a non-default local port, and
checks the served plugin asset and Remote response path. The prebuilt package is
published to npm as `dsh-local-share`; exact GitHub release and packed-tarball
installation use the same committed artifacts.

## Non-goals

DSH Local Share does not provide a hosted public URL, collaboration permissions,
editable replay data, complete diagnostic logs, attachment export, model tools,
or Feishu-specific publishing. The official Session log ZIP remains the right
format for diagnosis and migration.
