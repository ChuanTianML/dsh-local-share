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
