// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob, downloadShare } from '../src/client/download.ts'
import { fixtureResult } from './fixtures.ts'

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); document.body.replaceChildren() })

function environment() {
  vi.useFakeTimers()
  const createObjectURL = vi.fn(() => 'blob:https://fixture.test/download')
  const revokeObjectURL = vi.fn()
  const click = vi.fn()
  const append = document.body.append.bind(document.body)
  vi.spyOn(document.body, 'append').mockImplementation((...nodes) => {
    append(...nodes)
    const frame = nodes[0] as HTMLIFrameElement
    const frameWindow = frame.contentWindow as Window & typeof globalThis
    vi.spyOn(frameWindow.HTMLAnchorElement.prototype, 'click').mockImplementation(click)
  })
  return { document, createObjectURL, revokeObjectURL, click }
}

describe('local downloads', () => {
  it('isolates the download from parent anchor patches and releases the URL after dispatch', () => {
    const env = environment()
    const parentClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('host link rewriting must not run')
    })
    downloadShare(fixtureResult(), env)
    const frame = document.querySelector('iframe')!
    const anchor = frame.contentDocument!.querySelector('a')!
    expect(frame).toHaveAttribute('sandbox', 'allow-same-origin allow-downloads')
    expect(anchor.download).toBe('dsh-local-share-2026-08-14.md')
    expect(anchor.href).toBe('blob:https://fixture.test/download')
    expect(env.click).toHaveBeenCalledOnce()
    expect(parentClick).not.toHaveBeenCalled()
    expect(env.revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(frame.isConnected).toBe(false)
    expect(env.revokeObjectURL).toHaveBeenCalledWith('blob:https://fixture.test/download')
  })

  it('downloads binary PNG bytes with the supplied filename', () => {
    const env = environment()
    const blob = new Blob(['png'], { type: 'image/png' })
    downloadBlob(blob, 'share.png', env)
    expect(env.createObjectURL).toHaveBeenCalledWith(blob)
    expect(document.querySelector('iframe')!.contentDocument!.querySelector('a')!.download).toBe('share.png')
    vi.runAllTimers()
  })

  it('uses browser URL operations by default', () => {
    const env = environment()
    vi.stubGlobal('URL', Object.assign(URL, {
      createObjectURL: env.createObjectURL,
      revokeObjectURL: env.revokeObjectURL,
    }))
    downloadShare(fixtureResult())
    expect(env.click).toHaveBeenCalledOnce()
    vi.runAllTimers()
    expect(env.revokeObjectURL).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('releases the frame and URL when the browser refuses the click', () => {
    const env = environment()
    env.click.mockImplementation(() => { throw new Error('download blocked') })
    expect(() => downloadShare(fixtureResult(), env)).toThrow('download blocked')
    vi.runAllTimers()
    expect(document.querySelector('iframe')).toBeNull()
    expect(env.revokeObjectURL).toHaveBeenCalledOnce()
  })

  it('reports an unavailable frame document and still releases resources', () => {
    const env = environment()
    vi.spyOn(HTMLIFrameElement.prototype, 'contentDocument', 'get').mockReturnValue(null)
    // Avoid the test hook that installs a click spy inside the missing document.
    vi.mocked(document.body.append).mockRestore()
    expect(() => downloadShare(fixtureResult(), env)).toThrow('download frame is unavailable')
    vi.runAllTimers()
    expect(document.querySelector('iframe')).toBeNull()
    expect(env.revokeObjectURL).toHaveBeenCalledOnce()
  })
})
