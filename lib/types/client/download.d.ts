/** Browser-only downloads isolated from host-page link rewriting. */
import type { ShareResult } from '../contract.ts';
/** Browser operations used by {@link downloadShare}. */
export interface DownloadEnvironment {
    document: Document;
    createObjectURL: (blob: Blob) => string;
    revokeObjectURL: (url: string) => void;
}
/**
 * Download one rendered local document.
 * @param result - rendered file metadata and source.
 * @param environment - browser operations used to create and release local URLs.
 */
export declare function downloadShare(result: ShareResult, environment?: DownloadEnvironment): void;
/**
 * Start a Blob download from a script-free frame so host-page click handlers and
 * patched anchor prototypes cannot append session parameters to the Blob URL.
 * @param blob - browser-local file content.
 * @param filename - safe generated filename.
 * @param environment - browser operations used to create and release local URLs.
 */
export declare function downloadBlob(blob: Blob, filename: string, environment?: DownloadEnvironment): void;
