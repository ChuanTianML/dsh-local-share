/** Strict wire contract shared by the DSH Local Share Host and Web halves. */
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol';
import { z } from 'zod';
/** Supported local document formats. */
export declare const shareFormatSchema: z.ZodEnum<{
    markdown: "markdown";
    html: "html";
}>;
/** Explicit subset of human turns selected for one export; `null` means all. */
export declare const shareTurnSelectionSchema: z.ZodNullable<z.ZodArray<z.ZodNumber>>;
/** Stable warning codes interpreted by the browser and written into exports. */
export declare const shareWarningSchema: z.ZodEnum<{
    "redaction-best-effort": "redaction-best-effort";
    unredacted: "unredacted";
    "attachments-omitted": "attachments-omitted";
    "injected-context-omitted": "injected-context-omitted";
    "tools-omitted": "tools-omitted";
    "tool-arguments-truncated": "tool-arguments-truncated";
}>;
/** One render request for a validated Session id. */
export declare const shareRequestSchema: z.ZodReadonly<z.ZodObject<{
    sessionId: z.ZodString;
    format: z.ZodEnum<{
        markdown: "markdown";
        html: "html";
    }>;
    includeTools: z.ZodBoolean;
    redact: z.ZodBoolean;
    selectedTurnSeqs: z.ZodNullable<z.ZodArray<z.ZodNumber>>;
}, z.core.$strict>>;
/** Redacted metadata used by the browser's turn selector. */
export declare const shareTurnSchema: z.ZodReadonly<z.ZodObject<{
    startSeq: z.ZodNumber;
    preview: z.ZodString;
    messages: z.ZodNumber;
    toolCalls: z.ZodNumber;
}, z.core.$strict>>;
/** Counts that let the user audit what entered or left the document. */
export declare const shareStatsSchema: z.ZodReadonly<z.ZodObject<{
    turns: z.ZodNumber;
    messages: z.ZodNumber;
    toolCalls: z.ZodNumber;
    redactions: z.ZodNumber;
    attachmentsOmitted: z.ZodNumber;
    injectedMessagesOmitted: z.ZodNumber;
    toolArgumentsTruncated: z.ZodNumber;
}, z.core.$strict>>;
/** Rendered local file plus the isolated browser preview. */
export declare const shareResultSchema: z.ZodReadonly<z.ZodObject<{
    filename: z.ZodString;
    mimeType: z.ZodEnum<{
        "text/markdown;charset=utf-8": "text/markdown;charset=utf-8";
        "text/html;charset=utf-8": "text/html;charset=utf-8";
    }>;
    content: z.ZodString;
    previewHtml: z.ZodString;
    generatedAt: z.ZodISODateTime;
    capturedThroughSeq: z.ZodNullable<z.ZodNumber>;
    turns: z.ZodArray<z.ZodReadonly<z.ZodObject<{
        startSeq: z.ZodNumber;
        preview: z.ZodString;
        messages: z.ZodNumber;
        toolCalls: z.ZodNumber;
    }, z.core.$strict>>>;
    warnings: z.ZodArray<z.ZodEnum<{
        "redaction-best-effort": "redaction-best-effort";
        unredacted: "unredacted";
        "attachments-omitted": "attachments-omitted";
        "injected-context-omitted": "injected-context-omitted";
        "tools-omitted": "tools-omitted";
        "tool-arguments-truncated": "tool-arguments-truncated";
    }>>;
    stats: z.ZodReadonly<z.ZodObject<{
        turns: z.ZodNumber;
        messages: z.ZodNumber;
        toolCalls: z.ZodNumber;
        redactions: z.ZodNumber;
        attachmentsOmitted: z.ZodNumber;
        injectedMessagesOmitted: z.ZodNumber;
        toolArgumentsTruncated: z.ZodNumber;
    }, z.core.$strict>>;
}, z.core.$strict>>;
/** Request value accepted by `dshLocalShare/render`. */
export type ShareRequest = z.infer<typeof shareRequestSchema>;
/** Format selected for one generated document. */
export type ShareFormat = z.infer<typeof shareFormatSchema>;
/** Redacted turn metadata returned for local selection. */
export type ShareTurn = z.infer<typeof shareTurnSchema>;
/** Stable warning attached to one generated document. */
export type ShareWarning = z.infer<typeof shareWarningSchema>;
/** Result returned by `dshLocalShare/render`. */
export type ShareResult = z.infer<typeof shareResultSchema>;
/** DSH Local Share's strict Remote invocation descriptors. */
export declare const DSH_SHARE_INVOCATIONS: readonly InvocationDescriptor[];
