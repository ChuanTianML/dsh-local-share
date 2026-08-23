/** Strict wire contract shared by the DSH Local Share Host and Web halves. */
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'

/** Supported local document formats. */
export const shareFormatSchema = z.enum(['markdown', 'html'])

/** Explicit subset of human turns selected for one export; `null` means all. */
export const shareTurnSelectionSchema = z.array(z.number().int().nonnegative())
  .min(1)
  .refine(values => new Set(values).size === values.length, 'turn selections must be unique')
  .nullable()

/** Stable warning codes interpreted by the browser and written into exports. */
export const shareWarningSchema = z.enum([
  'redaction-best-effort',
  'unredacted',
  'attachments-omitted',
  'injected-context-omitted',
  'tools-omitted',
  'tool-arguments-truncated',
])

/** One render request for a validated Session id. */
export const shareRequestSchema = z.object({
  sessionId: z.string().min(1),
  format: shareFormatSchema,
  includeTools: z.boolean(),
  redact: z.boolean(),
  selectedTurnSeqs: shareTurnSelectionSchema,
}).strict().readonly()

/** Redacted metadata used by the browser's turn selector. */
export const shareTurnSchema = z.object({
  startSeq: z.number().int().nonnegative(),
  preview: z.string(),
  messages: z.number().int().nonnegative(),
  toolCalls: z.number().int().nonnegative(),
}).strict().readonly()

/** Counts that let the user audit what entered or left the document. */
export const shareStatsSchema = z.object({
  turns: z.number().int().nonnegative(),
  messages: z.number().int().nonnegative(),
  toolCalls: z.number().int().nonnegative(),
  redactions: z.number().int().nonnegative(),
  attachmentsOmitted: z.number().int().nonnegative(),
  injectedMessagesOmitted: z.number().int().nonnegative(),
  toolArgumentsTruncated: z.number().int().nonnegative(),
}).strict().readonly()

/** Rendered local file plus the isolated browser preview. */
export const shareResultSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.enum(['text/markdown;charset=utf-8', 'text/html;charset=utf-8']),
  content: z.string(),
  previewHtml: z.string(),
  generatedAt: z.iso.datetime(),
  capturedThroughSeq: z.number().int().nonnegative().nullable(),
  turns: z.array(shareTurnSchema),
  warnings: z.array(shareWarningSchema),
  stats: shareStatsSchema,
}).strict().readonly()

/** Request value accepted by `dshLocalShare/render`. */
export type ShareRequest = z.infer<typeof shareRequestSchema>

/** Format selected for one generated document. */
export type ShareFormat = z.infer<typeof shareFormatSchema>

/** Redacted turn metadata returned for local selection. */
export type ShareTurn = z.infer<typeof shareTurnSchema>

/** Stable warning attached to one generated document. */
export type ShareWarning = z.infer<typeof shareWarningSchema>

/** Result returned by `dshLocalShare/render`. */
export type ShareResult = z.infer<typeof shareResultSchema>

/** DSH Local Share's strict Remote invocation descriptors. */
export const DSH_SHARE_INVOCATIONS: readonly InvocationDescriptor[] = [
  {
    id: 'dsh-local-share#dshLocalShare/render',
    service: 'dshLocalShare',
    namespace: 'dshLocalShare',
    method: 'render',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'request',
        wire: 'request',
        source: 'json',
        codec: {
          mode: 'strict',
          typeSymbol: 'dsh-local-share#ShareRequest',
          schema: shareRequestSchema,
        },
      },
    ],
    cancellation: { parameter: 'signal' },
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-local-share#ShareResult',
      schema: shareResultSchema,
    },
  },
]
