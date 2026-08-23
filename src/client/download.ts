/** Browser-only download helper for generated local files. */
import type { ShareResult } from '../contract.ts'

/** Browser operations used by {@link downloadShare}. */
export interface DownloadEnvironment {
  document: Document
  createObjectURL: (blob: Blob) => string
  revokeObjectURL: (url: string) => void
}

/**
 * Start one local browser download and release its object URL.
 * @param result - rendered file metadata and source.
 * @param environment - injectable browser operations for tests.
 */
export function downloadShare(
  result: ShareResult,
  environment: DownloadEnvironment = {
    document,
    createObjectURL: blob => URL.createObjectURL(blob),
    revokeObjectURL: url => { URL.revokeObjectURL(url) },
  },
): void {
  const blob = new Blob([result.content], { type: result.mimeType })
  downloadBlob(blob, result.filename, environment)
}

/**
 * Start one local Blob download and release its object URL.
 * @param blob - browser-local file content.
 * @param filename - safe generated filename.
 * @param environment - injectable browser operations for tests.
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
  const url = environment.createObjectURL(blob)
  const anchor = environment.document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.hidden = true
  environment.document.body.append(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    environment.revokeObjectURL(url)
  }
}
