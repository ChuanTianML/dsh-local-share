import { describe, expect, it } from 'vitest'
import {
  DSH_SHARE_INVOCATIONS,
  shareRequestSchema,
  shareResultSchema,
} from '../src/contract.ts'
import { fixtureResult } from './fixtures.ts'

describe('DSH Local Share wire contract', () => {
  it('accepts the complete request and rejects unknown or malformed fields', () => {
    const request = { sessionId: 's1', format: 'markdown', includeTools: false, redact: true, selectedTurnSeqs: null }
    expect(shareRequestSchema.parse(request)).toEqual(request)
    expect(shareRequestSchema.parse({ ...request, selectedTurnSeqs: [1, 7] }).selectedTurnSeqs).toEqual([1, 7])
    expect(() => shareRequestSchema.parse({ ...request, format: 'pdf' })).toThrow()
    expect(() => shareRequestSchema.parse({ ...request, extra: true })).toThrow()
    expect(() => shareRequestSchema.parse({ ...request, sessionId: '' })).toThrow()
    expect(() => shareRequestSchema.parse({ ...request, selectedTurnSeqs: [] })).toThrow()
    expect(() => shareRequestSchema.parse({ ...request, selectedTurnSeqs: [1, 1] })).toThrow()
  })

  it('accepts the complete result and rejects loose statistics', () => {
    expect(shareResultSchema.parse(fixtureResult())).toEqual(fixtureResult())
    const result = fixtureResult()
    expect(() => shareResultSchema.parse({
      ...result,
      stats: { ...result.stats, redactions: -1 },
    })).toThrow()
    expect(() => shareResultSchema.parse({ ...result, warnings: ['unknown'] })).toThrow()
  })

  it('publishes one strict cancellable direct invocation', () => {
    expect(DSH_SHARE_INVOCATIONS).toHaveLength(1)
    expect(DSH_SHARE_INVOCATIONS[0]).toMatchObject({
      id: 'dsh-local-share#dshLocalShare/render',
      service: 'dshLocalShare',
      namespace: 'dshLocalShare',
      method: 'render',
      invocation: { kind: 'direct' },
      cancellation: { parameter: 'signal' },
      result: { mode: 'strict' },
    })
  })
})
