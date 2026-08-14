# Security

DSH Share creates files locally in the browser. It does not upload content or
make outbound network requests.

Redaction is a best-effort safeguard, not a proof that a document is safe to
publish. Review the preview before copying or downloading. If redaction is
disabled, the Web UI requires a fresh acknowledgement before either action.

The exporter never includes model reasoning, system prompts, request headers,
plugin-injected user-role context, attachment bytes, Session ids, or working
directory metadata. Tool arguments are excluded unless the user enables them.

Report a suspected vulnerability privately through GitHub's security advisory
feature for this repository. Do not include real credentials or private Session
content in a public issue.
