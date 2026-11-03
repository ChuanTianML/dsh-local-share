/** Browser-only downloads isolated from host-page link rewriting. */
import type { ShareResult } from '../contract.ts'

/** Browser operations used by {@link downloadShare}. */
export interface DownloadEnvironment {
  document: Document
  createObjectURL: (blob: Blob) => string
  revokeObjectURL: (url: string) => void
}

/**
 * Download one rendered local document.
 * @param result - rendered file metadata and source.
 * @param environment - browser operations used to create and release local URLs.
 */
export function downloadShare(
  result: ShareResult,
  environment?: DownloadEnvironment,
): void {
  downloadBlob(new Blob([result.content], { type: result.mimeType }), result.filename, environment)
}

/**
 * Start a Blob download from a script-free frame so host-page click handlers and
 * patched anchor prototypes cannot append session parameters to the Blob URL.
 * @param blob - browser-local file content.
 * @param filename - safe generated filename.
 * @param environment - browser operations used to create and release local URLs.
 */
export function downloadBlob(
  blob: Blob,
  filename: string,
  environment: DownloadEnvironment = {
    document,
    createObjectURL: value => URL.createObjectURL(value),
    revokeObjectURL: url => { URL.revokeObjectURL(url) },
  },
): void {
  const frame = environment.document.createElement('iframe')
  frame.hidden = true
  frame.setAttribute('sandbox', 'allow-same-origin allow-downloads')
  frame.title = 'Local file download'
  environment.document.body.append(frame)
  const url = environment.createObjectURL(blob)
  try {
    const frameDocument = frame.contentDocument
    if (frameDocument === null) throw new Error('dsh-local-share: download frame is unavailable')
    const anchor = frameDocument.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.rel = 'noopener'
    frameDocument.body.append(anchor)
    anchor.click()
  } finally {
    // Let the browser consume the queued download before releasing its document.
    setTimeout(() => {
      frame.remove()
      environment.revokeObjectURL(url)
    }, 1000)
  }
}
