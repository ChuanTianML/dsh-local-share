/** Strict wire contract shared by the DSH Share Host and Web halves. */
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'

/** Supported local document formats. */
export const shareFormatSchema = z.enum(['markdown', 'html'])

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
}).strict().readonly()

/** Counts that let the user audit what entered or left the document. */
export const shareStatsSchema = z.object({
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
  warnings: z.array(shareWarningSchema),
  stats: shareStatsSchema,
}).strict().readonly()

/** Request value accepted by `dshShare/render`. */
export type ShareRequest = z.infer<typeof shareRequestSchema>

/** Format selected for one generated document. */
export type ShareFormat = z.infer<typeof shareFormatSchema>

/** Stable warning attached to one generated document. */
export type ShareWarning = z.infer<typeof shareWarningSchema>

/** Result returned by `dshShare/render`. */
export type ShareResult = z.infer<typeof shareResultSchema>

/** DSH Share's strict Remote invocation descriptors. */
export const DSH_SHARE_INVOCATIONS: readonly InvocationDescriptor[] = [
  {
    id: 'dsh-share#dshShare/render',
    service: 'dshShare',
    namespace: 'dshShare',
    method: 'render',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'request',
        wire: 'request',
        source: 'json',
        codec: {
          mode: 'strict',
          typeSymbol: 'dsh-share#ShareRequest',
          schema: shareRequestSchema,
        },
      },
    ],
    cancellation: { parameter: 'signal' },
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-share#ShareResult',
      schema: shareResultSchema,
    },
  },
]
