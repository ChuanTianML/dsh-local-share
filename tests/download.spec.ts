// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadShare } from '../src/client/download.ts'
import { fixtureResult } from './fixtures.ts'

afterEach(() => { vi.restoreAllMocks() })

describe('downloadShare', () => {
  it('clicks a filename-bound local URL and revokes it immediately', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const createObjectURL = vi.fn(() => 'blob:fixture')
    const revokeObjectURL = vi.fn()
    downloadShare(fixtureResult(), { document, createObjectURL, revokeObjectURL })

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement
    expect(anchor.download).toBe('dsh-share-2026-08-14.md')
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
})
