# Changelog

## 0.4.1 - 2026-08-23

- Surface turn selection, local Markdown, self-contained HTML, long PNG,
  redaction, and the no-upload data path in npm metadata, the plugin manifest,
  and the first README paragraph so Coding Agents can identify the complete
  core feature set before installation.
- Add npm discovery keywords for turn selection, multi-turn sharing, and
  conversation export.

## 0.4.0 - 2026-08-23

- Group shareable content into user-led turns and let the user export any
  non-empty turn subset while preserving log order, privacy filtering, and
  redaction.
- Add browser-local long PNG copy and download from the same script-free HTML
  preview, with conservative canvas limits and no upload path.
- Publish the prebuilt plugin as the `dsh-local-share` npm package while keeping
  exact GitHub release installation available.

## 0.3.0 - 2026-08-15

- Keep a fixed preview surface while privacy and format options regenerate,
  cover each isolated iframe generation immediately until its new document is
  painted, preserve the dialog scroll position during option changes, and
  return to the top whenever the dialog reopens.
- Render visible assistant GFM as static semantic HTML while preserving human
  prompts literally. Raw HTML stays escaped, images are omitted, unsafe links
  are inert, and the preview remains script-free and sandboxed.
- Refresh the self-contained document with an Apple-inspired reading layout,
  complete Markdown typography, dark mode, print styles, and responsive
  spacing.

## 0.2.0 - 2026-08-15

- Rename the package, plugin id, browser module, Remote namespace, and generated
  filenames from `dsh-share` to `dsh-local-share` so the plugin has a distinct
  identity in the DSH community catalog.
- Add a visual product walkthrough, exact Host configuration, isolated
  verification commands, and a copyable Coding Agent installation prompt.
- Preserve the existing local-only data path, privacy defaults, and export
  formats. Version 0.1.0 users must remove `dsh-share` before installing
  `dsh-local-share`.

## 0.1.0 - 2026-08-14

- Add a Web Session Header action for local Markdown and single-file HTML
  sharing.
- Export only direct human prompts and visible assistant text by default.
- Add opt-in bounded tool-call details without tool result bodies.
- Enable heuristic credential, identity, and local-path redaction by default.
- Require preview and explicit acknowledgement before unredacted copy or
  download.
- Add strict Host/browser wire codecs, resource limits, bilingual UI copy, and
  isolated Harness verification.
