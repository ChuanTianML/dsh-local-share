# AGENTS.md — dsh-share

This repository contains an out-of-tree DeepSeek Harness plugin. The Host half
reads a validated Session snapshot and exposes one strict Typert Remote. The Web
half contributes a privacy-first Share action to
`conversation.session.header.utilities`.

## Conventions

- `src/contract.ts` is the single wire definition shared by the Host manifest
  and Web contribution.
- Export only direct human prompts and visible assistant text. Never export
  reasoning, request headers, system prompts, plugin-injected context, raw
  stream chunks, attachment bytes, session ids, or working-directory metadata.
- Redaction is enabled by default. Disabling it requires an explicit browser
  acknowledgement before copy or download.
- The plugin performs no upload and makes no outbound network request.
- Registrations use Cordis effects and are withdrawn on disposal.
- User-facing copy has Simplified Chinese and English dictionaries. Code,
  comments, JSDoc, wire errors, and generated document metadata use English.
- `pnpm run check` is the local gate. Commit `lib/` because GitHub profile
  installs run without a build step.
- The development Harness checkout is isolated under `.sandbox/harness` or
  selected with `DSH_HARNESS_ROOT`; never edit that checkout from this repo.
