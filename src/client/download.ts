/** Browser-only download helper for generated local files. */
import type { ShareResult } from '../contract.ts'

/** Browser operations used by {@link downloadShare}. */
export interface DownloadEnvironment {
  document: Document
  createObjectURL: (blob: Blob) => string
  revokeObjectURL: (url: string) => void
}

/** Minimal File System Access API surface used by the hub-safe download path. */
interface FilePickerWindow {
  showSaveFilePicker?: (options?: {
    suggestedName?: string
    types?: readonly { description?: string, accept: Record<string, readonly string[]> }[]
  }) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>, close: () => Promise<void> }> }>
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
  void downloadBlob(blob, result.filename, environment)
}

/**
 * Start one local Blob download and release its object URL.
 *
 * A hosting proxy that rewrites same-origin link targets — DSH Hub tags every
 * same-origin URL with its tab-session token during the click — also rewrites
 * `blob:` URLs, because a Blob URL reports the origin that created it. The
 * appended query makes the URL invalid and the browser refuses the download.
 * When that wrapper is detected, the file is written through the File System
 * Access API instead, which never exposes a URL to the host page.
 * @param blob - browser-local file content.
 * @param filename - safe generated filename.
 * @param environment - injectable browser operations for tests.
 */
export async function downloadBlob(
  blob: Blob,
  filename: string,
  environment: DownloadEnvironment = {
    document,
    createObjectURL: value => URL.createObjectURL(value),
    revokeObjectURL: url => { URL.revokeObjectURL(url) },
  },
): Promise<void> {
  const scope = globalThis as FilePickerWindow & { __dshHubTabSessionWrapped?: boolean }
  if (scope.__dshHubTabSessionWrapped && typeof scope.showSaveFilePicker === 'function') {
    try {
      const handle = await scope.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Shared document', accept: { [blob.type.split(';')[0] ?? '']: [] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (reason) {
      // A cancelled picker is a finished download attempt; anything else falls back.
      if (reason instanceof Error && reason.name === 'AbortError') { return }
    }
  }
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
