# Changelog

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
