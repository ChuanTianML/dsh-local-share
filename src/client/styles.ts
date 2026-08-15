/** CSS carried inside the one-file browser plugin bundle. */
const CSS = `
.dsh-local-share-action{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}.dsh-local-share-action:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-local-share-dialog{width:min(900px,calc(100vw - 32px));max-width:900px}.dsh-local-share-content{max-height:min(82vh,820px);overflow:auto}.dsh-local-share-options{display:grid;grid-template-columns:1fr 1fr;gap:14px 20px;padding:14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px}.dsh-local-share-fieldset{border:0;padding:0;margin:0}.dsh-local-share-legend{font-size:12px;font-weight:600;margin:0 0 8px}.dsh-local-share-choice,.dsh-local-share-check{display:flex;align-items:flex-start;gap:8px;font-size:13px;line-height:1.45;margin:6px 0;cursor:pointer}.dsh-local-share-choice input,.dsh-local-share-check input{margin-top:3px}.dsh-local-share-risk{grid-column:1/-1;padding:10px 12px;border-radius:9px;background:var(--dsw-alias-status-warning-bg,#fff2cc)}.dsh-local-share-preview-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:18px 0 8px}.dsh-local-share-preview-title{font-size:13px;font-weight:600}.dsh-local-share-stats{font-size:12px;color:var(--dsw-alias-label-secondary)}.dsh-local-share-frame{display:block;width:100%;height:min(52vh,520px);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:#fff}.dsh-local-share-placeholder{display:grid;place-items:center;min-height:220px;border:1px dashed var(--dsw-alias-border-l2);border-radius:12px;color:var(--dsw-alias-label-secondary);font-size:13px}.dsh-local-share-error{color:var(--dsw-alias-status-error,#b42318)}.dsh-local-share-warnings{margin:10px 0 0;padding-left:20px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5}.dsh-local-share-footer{display:flex;justify-content:flex-end;gap:8px;width:100%}@media(max-width:640px){.dsh-local-share-options{grid-template-columns:1fr}.dsh-local-share-risk{grid-column:auto}.dsh-local-share-frame{height:46vh}}
`

/** Install plugin styles and return their disposer. */
export function adoptStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.dshLocalShare = 'true'
  style.textContent = CSS
  document.head.append(style)
  return () => { style.remove() }
}
