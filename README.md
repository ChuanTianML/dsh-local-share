# DSH Share

[![CI](https://github.com/ChuanTianML/dsh-share/actions/workflows/ci.yml/badge.svg)](https://github.com/ChuanTianML/dsh-share/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Privacy-first Markdown and self-contained HTML sharing for
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Sessions.
DSH Share is an independent community plugin.

[简体中文](README.zh.md)

DSH Share adds a **Share** action to the Web Session header. It creates a local
preview, then lets you copy the generated source or download it. Nothing is
uploaded and the plugin makes no outbound request.

## Why DSH Share

The official Session log export is the right lossless ZIP for diagnosis and
migration. DSH Share produces a smaller, human-readable document for review,
issue reports, and knowledge sharing.

- Markdown or one script-free HTML file
- Best-effort redaction enabled by default
- Preview before copy or download
- Tool calls opt-in and collapsed
- No cloud service, account, or public-link backend
- Zero model-visible text and zero model-token overhead

## Install

DSH is currently a developer preview. Install the tagged GitHub bundle into the
Web profile:

```sh
dsh plugin --profile web add github:ChuanTianML/dsh-share#v0.1.0
dsh --profile web
```

Open a non-empty Session and select **Share** in its header.

To remove the plugin:

```sh
dsh plugin --profile web remove dsh-share
```

## Privacy behavior

The default document contains only direct human prompts and visible assistant
text in log order.

| Content | Default | Optional |
| --- | --- | --- |
| Human prompts | Included | — |
| Visible assistant text | Included | — |
| Tool names, bounded arguments, outcomes | Excluded | Enable “Include tool calls” |
| Tool result bodies | Excluded | Never included |
| Reasoning / thinking | Excluded | Never included |
| System prompts and request configuration | Excluded | Never included |
| Plugin-injected user-role context | Excluded | Never included |
| Attachment bytes and Session metadata | Excluded | Never included |

Redaction covers common credentials, authorization headers, secret-bearing
environment assignments, email addresses, and absolute local paths. It is
heuristic, not a guarantee. Always review the preview. If redaction is disabled,
copy and download remain locked until a fresh risk acknowledgement is checked.

The preview runs in a sandboxed `srcdoc` iframe. Generated HTML has no scripts or
external resources and carries a restrictive Content Security Policy.

## Host configuration

All resource limits are validated when the plugin loads.

| Field | Default | Meaning |
| --- | ---: | --- |
| `maxEvents` | `20000` | Maximum raw Session events accepted |
| `maxOutputChars` | `2000000` | Maximum file or preview characters |
| `maxToolArgumentChars` | `12000` | Maximum retained arguments per enabled tool call |

Session and output overflows fail visibly. Tool arguments alone may be
truncated, with a warning in the preview.

## Development

The verified Harness revision is
`47f943859bef60e4160492346772ded9b24f765a`. Keep the checkout isolated under
`.sandbox/harness`:

```sh
corepack enable
pnpm install
git clone https://github.com/deepseek-ai/deepseek-harness.git .sandbox/harness
git -C .sandbox/harness checkout 47f943859bef60e4160492346772ded9b24f765a
pnpm --dir .sandbox/harness install --frozen-lockfile
pnpm --dir .sandbox/harness run build
pnpm run check
```

`DSH_HARNESS_ROOT=/absolute/path/to/deepseek-harness` selects another read-only
development checkout. `pnpm run check` runs strict type checks, ESLint, unit and
composition tests, Host/browser builds, and a package dry run. Built `lib/`
artifacts are committed because profile installs do not run a build step.

The complete product and security design is in [docs/design.md](docs/design.md).

## Compatibility

Version 0.1.0 targets the DSH developer-preview API at the verified revision
above. DSH does not yet promise stable external plugin compatibility; future
Harness changes may require a new DSH Share release.

## Security

See [SECURITY.md](SECURITY.md). Never include a real credential or private
Session in a public issue.

## License

MIT
