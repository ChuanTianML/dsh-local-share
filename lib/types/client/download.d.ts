/** Browser-only download helper for generated local files. */
import type { ShareResult } from '../contract.ts';
/** Browser operations used by {@link downloadShare}. */
export interface DownloadEnvironment {
    document: Document;
    createObjectURL: (blob: Blob) => string;
    revokeObjectURL: (url: string) => void;
}
/**
 * Start one local browser download and release its object URL.
 * @param result - rendered file metadata and source.
 * @param environment - injectable browser operations for tests.
 */
export declare function downloadShare(result: ShareResult, environment?: DownloadEnvironment): void;
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
export declare function downloadBlob(blob: Blob, filename: string, environment?: DownloadEnvironment): Promise<void>;
