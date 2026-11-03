# Local Share 0.5.0 validation

## Supported runtime

This release requires Harness >=0.2.1-rc.5 and <0.3.0. The verified target is the
published `@deepseek-ai/dsh@0.2.1-rc.5`, with matching source revision
`b830ec950faba0a46dda564be3e2d854afed94f1`. Earlier Harness releases do not
provide the same client modules and message types; upgrade Harness first.

## Changes

Issue #6 and contributor PR #7 identified removed icon exports, strict codecs
without lazy factories, and Blob URLs corrupted by a host's click-time session
query rewriting. The release retains the contributor's icon and codec fixes.
Current Harness integration uses Cordis Context, the UI renderer, and Gateway
in place of the removed client-runtime package. Tool outcomes read the current
message-level `isError` flag and never expose tool result contents.

Downloads dispatch from a hidden, same-origin, script-free frame with downloads
allowed. Parent-document event listeners and patched parent anchor prototypes
do not see that click. The Blob URL and frame are released after dispatch. This
works without File System Access API support or a second user gesture after
PNG generation. The rendered document is never loaded into this download frame.

PNG generation disables duplicate actions without revoking the user's export
consent. Closing the dialog, changing preview options, or withdrawing consent
still prevents the pending image from being exported.

## Repeatable checks

- `pnpm run check`: strict source/test type checks, ESLint, all unit and
  composition tests with the existing coverage thresholds, rebuild of committed
  Host/browser/type artifacts, and package dry run.
- `pnpm exec playwright install chromium` then `pnpm run test:browser`: pack
  the plugin, install it with the real CLI into a fresh temporary DSH_HOME,
  seed two synthetic turns through the official Session/persistence APIs, start
  the Web application, and inspect actual downloaded files in Chromium.
- `DSH_TEST_CLI=/absolute/path/to/dsh/lib/bin.js pnpm run test:browser` selects
  an independently installed official CLI. `DSH_HARNESS_ROOT` selects the
  isolated source checkout used for development. `PLAYWRIGHT_EXECUTABLE_PATH`
  optionally selects an already-installed test browser.

The browser check covers the header action, live render Remote, Markdown/HTML/PNG
file bytes, redaction and reasoning omission, selected-turn export, consent reset,
and all three downloads with prototype and document-level URL rewriting enabled.
It requires no model invocation or real session data. Screenshots and a generated
PNG are retained under the printed temporary evidence directory.

## Local results

On 2026-11-03, the complete local gate passed all 64 tests in 9 files, both
TypeScript checks, ESLint, builds, and package validation. Coverage was 94.98%
statements, 87.86% branches, 98.18% functions, and 98.37% lines. The packed
plugin also passed the browser check against an independently installed official
npm Harness 0.2.1-rc.5. Desktop and narrow-viewport screenshots and the generated
PNG were inspected.

## Regression evidence

On macOS with Node 24.4.1, restoring the original codecs and icon imports against
the current Harness makes all 18 Host composition/dialog tests fail. The legacy
codec fails registration with `result strict codec has no create() factory`.

A delayed PNG capture reproduces the former first-click failure for both copy
and download. Both new regressions fail before the consent-state correction.
The existing consent-withdrawal regression remains required.

CI repeats the checks and packed browser test on Linux and Windows with Node
22.22.0 and 24.15.0. The Hub test reproduces the reported rewriting behavior;
it does not claim to test a separately deployed DSH Hub server. Chromium is the
browser acceptance target; Firefox and Safari are not claimed as tested.
