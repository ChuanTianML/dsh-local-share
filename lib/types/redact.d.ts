/** Privacy-first, deterministic text redaction used before document rendering. */
/** Result of applying all DSH Share redaction rules to one string. */
export interface RedactionResult {
    /** Redacted text. */
    text: string;
    /** Number of matched sensitive spans replaced. */
    count: number;
}
/**
 * Remove common credentials, identity data, and absolute local paths.
 * @param text - untrusted Session text or tool arguments.
 * @returns redacted text and the number of replacements.
 */
export declare function redactText(text: string): RedactionResult;
