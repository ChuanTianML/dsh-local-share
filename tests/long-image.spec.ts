// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  captureLongImage,
  copyLongImage,
  LongImageError,
  longImageFilename,
  longImageScale,
  MAX_LONG_IMAGE_EDGE,
  MAX_LONG_IMAGE_PIXELS,
} from '../src/client/long-image.ts'

describe('browser-local long image', () => {
  it('uses the largest useful scale within the edge and pixel budgets', () => {
    expect(longImageScale(800, 2_000)).toBe(2)
    expect(longImageScale(800, 10_000)).toBeCloseTo(Math.sqrt(MAX_LONG_IMAGE_PIXELS / 8_000_000))
    expect(() => longImageScale(100, MAX_LONG_IMAGE_EDGE + 1)).toThrow(LongImageError)
    expect(() => longImageScale(0, 10)).toThrow(/no measurable content/u)
    expect(() => longImageScale(Number.NaN, 10)).toThrow(/no measurable content/u)
  })

  it('captures the full same-origin preview as PNG with explicit canvas dimensions', async () => {
    const frame = document.createElement('iframe')
    document.body.append(frame)
    const preview = frame.contentDocument
    if (preview === null) throw new Error('fixture iframe document missing')
    Object.defineProperty(preview.documentElement, 'scrollWidth', { configurable: true, value: 800 })
    Object.defineProperty(preview.documentElement, 'scrollHeight', { configurable: true, value: 2_000 })
    const blob = new Blob(['png'], { type: 'image/png' })
    const capture = vi.fn(async () => blob)

    await expect(captureLongImage(frame, capture)).resolves.toBe(blob)
    expect(capture).toHaveBeenCalledWith(preview.documentElement, expect.objectContaining({
      width: 800,
      height: 2_000,
      canvasWidth: 1_600,
      canvasHeight: 4_000,
      pixelRatio: 1,
      skipFonts: true,
    }))
  })

  it('fails safely for an unavailable preview or invalid encoder result', async () => {
    const missingFrame = { contentDocument: null } as HTMLIFrameElement
    await expect(captureLongImage(missingFrame, vi.fn())).rejects.toThrow(/preview is not ready/u)

    const frame = document.createElement('iframe')
    document.body.append(frame)
    const preview = frame.contentDocument
    if (preview === null) throw new Error('fixture iframe document missing')
    Object.defineProperty(preview.documentElement, 'scrollWidth', { configurable: true, value: 400 })
    Object.defineProperty(preview.documentElement, 'scrollHeight', { configurable: true, value: 600 })
    await expect(captureLongImage(frame, vi.fn(async () => null))).rejects.toThrow(/could not encode/u)
    await expect(captureLongImage(
      frame,
      vi.fn(async () => new Blob(['jpeg'], { type: 'image/jpeg' })),
    )).rejects.toThrow(/could not encode/u)
  })

  it('creates a PNG filename and reports clipboard support or refusal', async () => {
    expect(longImageFilename('dsh-local-share-2026-08-23.md')).toBe('dsh-local-share-2026-08-23.png')
    expect(longImageFilename('dsh-local-share-2026-08-23.html')).toBe('dsh-local-share-2026-08-23.png')
    const blob = new Blob(['png'], { type: 'image/png' })
    const write = vi.fn(async () => {})
    class FixtureClipboardItem {
      constructor(readonly items: Record<string, Blob>) {}
    }

    await expect(copyLongImage(
      blob,
      { write },
      FixtureClipboardItem as unknown as typeof ClipboardItem,
    )).resolves.toBe(true)
    expect(write).toHaveBeenCalledWith([expect.objectContaining({ items: { 'image/png': blob } })])
    await expect(copyLongImage(blob, undefined, undefined)).resolves.toBe(false)
    await expect(copyLongImage(
      blob,
      { write: vi.fn(async () => { throw new Error('clipboard refused') }) },
      FixtureClipboardItem as unknown as typeof ClipboardItem,
    )).resolves.toBe(false)
  })
})
