// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob, downloadShare } from '../src/client/download.ts'
import { fixtureResult } from './fixtures.ts'

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(globalThis, '__dshHubTabSessionWrapped')
  Reflect.deleteProperty(globalThis, 'showSaveFilePicker')
})

describe('downloadShare', () => {
  it('clicks a filename-bound local URL and revokes it immediately', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const createObjectURL = vi.fn(() => 'blob:fixture')
    const revokeObjectURL = vi.fn()
    downloadShare(fixtureResult(), { document, createObjectURL, revokeObjectURL })

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement
    expect(anchor.download).toBe('dsh-local-share-2026-08-14.md')
    expect(anchor.href).toBe('blob:fixture')
    expect(anchor.isConnected).toBe(false)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fixture')
  })

  it('uses the browser URL implementation by default', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const createObjectURL = vi.fn(() => 'blob:default')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })

    downloadShare(fixtureResult())
    expect(click).toHaveBeenCalledOnce()
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:default')
  })

  it('writes through the file picker instead of a blob link under a URL-rewriting host', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const createObjectURL = vi.fn(() => 'blob:rewritten')
    const revokeObjectURL = vi.fn()
    const write = vi.fn()
    const close = vi.fn()
    const picker = vi.fn(async () => ({ createWritable: async () => ({ write, close }) }))
    // DSH Hub marks its injected wrapper with this flag; see src/client/download.ts.
    Object.defineProperty(globalThis, '__dshHubTabSessionWrapped', { configurable: true, value: true })
    Object.defineProperty(globalThis, 'showSaveFilePicker', { configurable: true, value: picker })

    const result = fixtureResult()
    await downloadBlob(new Blob([result.content], { type: result.mimeType }), result.filename, { document, createObjectURL, revokeObjectURL })

    expect(picker).toHaveBeenCalledWith({
      suggestedName: 'dsh-local-share-2026-08-14.md',
      types: [{ description: 'Shared document', accept: { 'text/markdown': [] } }],
    })
    expect(write).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(click).not.toHaveBeenCalled()
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('treats a cancelled file picker as a finished download attempt', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const createObjectURL = vi.fn(() => 'blob:kept')
    const revokeObjectURL = vi.fn()
    const abort = new Error('cancelled')
    abort.name = 'AbortError'
    Object.defineProperty(globalThis, '__dshHubTabSessionWrapped', { configurable: true, value: true })
    Object.defineProperty(globalThis, 'showSaveFilePicker', { configurable: true, value: vi.fn(() => Promise.reject(abort)) })

    const result = fixtureResult()
    await downloadBlob(new Blob([result.content], { type: result.mimeType }), result.filename, { document, createObjectURL, revokeObjectURL })

    expect(click).not.toHaveBeenCalled()
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
