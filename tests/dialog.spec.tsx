// @vitest-environment jsdom
import { act, cleanup, fireEvent, render as renderReact, screen, waitFor } from '@testing-library/react'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShareRequest } from '../src/contract.ts'
import { DshShareHeaderAction, type DshShareProps } from '../src/client/Dialog.tsx'
import { en } from '../src/client/locales.ts'
import { fixtureResult } from './fixtures.ts'

const browserActions = vi.hoisted(() => ({ write: vi.fn(), download: vi.fn() }))

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async importOriginal => ({
  ...await importOriginal<typeof import('@deepseek-ai/dsh-client-ui-primitives')>(),
  writeClipboard: browserActions.write,
}))

vi.mock('../src/client/download.ts', () => ({
  downloadShare: browserActions.download,
}))

afterEach(cleanup)

beforeEach(() => {
  browserActions.write.mockReset()
  browserActions.write.mockResolvedValue(true)
  browserActions.download.mockReset()
})

function translate(key: keyof typeof en, params?: Record<string, unknown>): string {
  let value = en[key]
  for (const [name, replacement] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{${name}}`, String(replacement))
  }
  return value
}

function props(render: DshShareProps['render']): DshShareProps {
  return {
    sessionId: 'session-1' as SessionId,
    render,
    t: translate,
  } as DshShareProps
}

async function loadPreview(): Promise<HTMLIFrameElement> {
  const frame = await screen.findByTitle<HTMLIFrameElement>('Preview')
  fireEvent.load(frame)
  await waitFor(() => { expect(screen.queryByRole('status')).not.toBeInTheDocument() })
  return frame
}

describe('DSH Local Share dialog', () => {
  it('opens with privacy-first defaults and shows the sandboxed preview', async () => {
    const remote = vi.fn(async (_request: ShareRequest, _signal?: AbortSignal) => fixtureResult())
    renderReact(<DshShareHeaderAction {...props(remote)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    const frame = await loadPreview()
    expect(remote).toHaveBeenCalledOnce()
    expect(remote.mock.calls[0]?.[0]).toEqual({
      sessionId: 'session-1', format: 'markdown', includeTools: false, redact: true,
    })
    expect(frame).toHaveAttribute('sandbox', '')
    expect(screen.getByLabelText('Automatic redaction')).toBeChecked()
    expect(screen.getByLabelText('Include tool calls (arguments and outcome)')).not.toBeChecked()
    const acknowledgement = screen.getByLabelText(/I reviewed the preview/)
    expect(acknowledgement).toBeDisabled()
    expect(acknowledgement.closest('label')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('2 messages · 1 tool calls · 3 redactions')).toBeInTheDocument()
  })

  it('requires a fresh acknowledgement after redaction is disabled', async () => {
    const remote = vi.fn(async (request: ShareRequest) => fixtureResult({
      warnings: [request.redact ? 'redaction-best-effort' : 'unredacted'],
    }))
    renderReact(<DshShareHeaderAction {...props(remote)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await loadPreview()

    fireEvent.click(screen.getByLabelText('Automatic redaction'))
    await waitFor(() => { expect(remote).toHaveBeenCalledTimes(2) })
    await loadPreview()
    const copy = screen.getByRole('button', { name: 'Copy source' })
    const download = screen.getByRole('button', { name: 'Download' })
    expect(copy).toBeDisabled()
    expect(download).toBeDisabled()

    fireEvent.click(screen.getByLabelText(/I reviewed the preview/))
    expect(copy).toBeEnabled()
    expect(download).toBeEnabled()
    fireEvent.click(copy)
    await screen.findByRole('button', { name: 'Copied' })
    expect(browserActions.write).toHaveBeenCalledWith('# Shared')
  })

  it('never enables export actions for a result generated with stale privacy options', async () => {
    let call = 0
    let resolveFresh: ((value: ReturnType<typeof fixtureResult>) => void) | undefined
    const remote = vi.fn((request: ShareRequest) => {
      call += 1
      if (call === 3) {
        return new Promise<ReturnType<typeof fixtureResult>>(resolve => { resolveFresh = resolve })
      }
      return Promise.resolve(fixtureResult({
        warnings: [request.redact ? 'redaction-best-effort' : 'unredacted'],
      }))
    })
    renderReact(<DshShareHeaderAction {...props(remote)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await loadPreview()

    fireEvent.click(screen.getByLabelText('Automatic redaction'))
    await waitFor(() => { expect(remote).toHaveBeenCalledTimes(2) })
    await loadPreview()
    fireEvent.click(screen.getByLabelText(/I reviewed the preview/))
    expect(screen.getByRole('button', { name: 'Copy source' })).toBeEnabled()

    fireEvent.click(screen.getByLabelText('Automatic redaction'))
    expect(screen.getByRole('button', { name: 'Copy source' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Copy source' }))
    expect(browserActions.write).not.toHaveBeenCalled()

    await waitFor(() => { expect(remote).toHaveBeenCalledTimes(3) })
    resolveFresh?.(fixtureResult())
    await loadPreview()
    expect(screen.getByRole('button', { name: 'Copy source' })).toBeEnabled()
  })

  it('aborts an obsolete render when options change', async () => {
    const pending: Array<{
      request: ShareRequest
      signal: AbortSignal | undefined
      resolve: (value: ReturnType<typeof fixtureResult>) => void
    }> = []
    const remote = vi.fn((request: ShareRequest, signal?: AbortSignal) => new Promise<ReturnType<typeof fixtureResult>>(resolve => {
      pending.push({ request, signal, resolve })
    }))
    renderReact(<DshShareHeaderAction {...props(remote)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await waitFor(() => { expect(pending).toHaveLength(1) })
    fireEvent.click(screen.getByLabelText('Single-file HTML'))
    await waitFor(() => { expect(pending).toHaveLength(2) })

    expect(pending[0]?.signal?.aborted).toBe(true)
    expect(pending[1]?.request.format).toBe('html')
    pending[1]?.resolve(fixtureResult({ filename: 'dsh-local-share-2026-08-14.html' }))
    expect(await screen.findByTitle('Preview')).toBeInTheDocument()
  })

  it('keeps one stable preview shell covered until changed HTML finishes loading', async () => {
    let resolveChanged: ((value: ReturnType<typeof fixtureResult>) => void) | undefined
    const remote = vi.fn((request: ShareRequest) => {
      if (!request.includeTools) return Promise.resolve(fixtureResult({ previewHtml: '<p>Initial preview</p>' }))
      return new Promise<ReturnType<typeof fixtureResult>>(resolve => { resolveChanged = resolve })
    })
    renderReact(<DshShareHeaderAction {...props(remote)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    const initialFrame = await loadPreview()
    const shell = initialFrame.parentElement

    fireEvent.click(screen.getByLabelText('Include tool calls (arguments and outcome)'))
    await waitFor(() => { expect(remote).toHaveBeenCalledTimes(2) })
    expect(screen.getByTitle('Preview')).toBe(initialFrame)
    expect(initialFrame).toHaveAttribute('srcdoc', '<p>Initial preview</p>')
    expect(initialFrame.parentElement).toBe(shell)
    expect(screen.getByRole('status')).toHaveTextContent('Generating a safe preview…')
    expect(screen.getByRole('button', { name: 'Copy source' })).toBeDisabled()

    await act(async () => {
      resolveChanged?.(fixtureResult({ previewHtml: '<p>Changed preview</p>' }))
    })
    const changedFrame = await waitFor(() => {
      const frame = screen.getByTitle<HTMLIFrameElement>('Preview')
      expect(frame).toHaveAttribute('srcdoc', '<p>Changed preview</p>')
      return frame
    })
    expect(changedFrame).not.toBe(initialFrame)
    expect(changedFrame.parentElement).toBe(shell)
    fireEvent.load(initialFrame)
    fireEvent.load(changedFrame)
    await waitFor(() => { expect(screen.queryByRole('status')).not.toBeInTheDocument() })
    expect(screen.getByRole('button', { name: 'Copy source' })).toBeEnabled()
  })

  it('ignores late frame loads while rapid option changes are still rendering', async () => {
    const pending: Array<(value: ReturnType<typeof fixtureResult>) => void> = []
    const remote = vi.fn(() => new Promise<ReturnType<typeof fixtureResult>>(resolve => { pending.push(resolve) }))
    renderReact(<DshShareHeaderAction {...props(remote)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await waitFor(() => { expect(pending).toHaveLength(1) })
    await act(async () => {
      pending[0]?.(fixtureResult({ previewHtml: '<p>Initial preview</p>' }))
    })
    const initialFrame = await loadPreview()

    fireEvent.click(screen.getByLabelText('Include tool calls (arguments and outcome)'))
    await waitFor(() => { expect(pending).toHaveLength(2) })
    fireEvent.click(screen.getByLabelText('Automatic redaction'))
    await waitFor(() => { expect(pending).toHaveLength(3) })

    fireEvent.load(initialFrame)
    expect(screen.getByRole('status')).toBeInTheDocument()
    await act(async () => {
      pending[1]?.(fixtureResult({ previewHtml: '<p>Obsolete preview</p>' }))
    })
    expect(screen.getByRole('status')).toBeInTheDocument()

    await act(async () => {
      pending[2]?.(fixtureResult({ previewHtml: '<p>Current preview</p>' }))
    })
    const currentFrame = await waitFor(() => {
      const frame = screen.getByTitle<HTMLIFrameElement>('Preview')
      expect(frame).toHaveAttribute('srcdoc', '<p>Current preview</p>')
      return frame
    })
    fireEvent.load(currentFrame)
    await waitFor(() => { expect(screen.queryByRole('status')).not.toBeInTheDocument() })
  })

  it('reveals only the current generation after its load has painted', async () => {
    let nextFrameId = 0
    const callbacks = new Map<number, FrameRequestCallback>()
    const requestFrame = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
      nextFrameId += 1
      callbacks.set(nextFrameId, callback)
      return nextFrameId
    })
    const cancelFrame = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(frameId => {
      callbacks.delete(frameId)
    })
    const remote = vi.fn(async (request: ShareRequest) => fixtureResult({
      previewHtml: `<p>${request.redact ? 'Redacted' : 'Unredacted'}</p>`,
    }))

    try {
      renderReact(<DshShareHeaderAction {...props(remote)} />)
      fireEvent.click(screen.getByRole('button', { name: 'Share' }))
      const firstFrame = await screen.findByTitle<HTMLIFrameElement>('Preview')
      fireEvent.load(firstFrame)
      await waitFor(() => { expect(requestFrame).toHaveBeenCalled() })
      const staleFrameId = Array.from(callbacks.keys()).at(-1)!
      const staleReveal = callbacks.get(staleFrameId)
      expect(staleReveal).toBeDefined()
      expect(screen.getByRole('status')).toBeInTheDocument()

      fireEvent.click(screen.getByLabelText('Automatic redaction'))
      await waitFor(() => { expect(remote).toHaveBeenCalledTimes(2) })
      expect(cancelFrame).toHaveBeenCalledWith(staleFrameId)
      await act(async () => { staleReveal?.(0) })
      expect(screen.getByRole('status')).toBeInTheDocument()

      const currentFrame = await waitFor(() => {
        const frame = screen.getByTitle<HTMLIFrameElement>('Preview')
        expect(frame).toHaveAttribute('srcdoc', '<p>Unredacted</p>')
        return frame
      })
      expect(currentFrame).not.toBe(firstFrame)
      const requestCount = requestFrame.mock.calls.length
      fireEvent.load(currentFrame)
      await waitFor(() => { expect(requestFrame.mock.calls.length).toBeGreaterThan(requestCount) })
      const currentReveal = callbacks.get(Array.from(callbacks.keys()).at(-1)!)
      expect(currentReveal).toBeDefined()
      expect(screen.getByRole('status')).toBeInTheDocument()
      await act(async () => { currentReveal?.(16) })
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    } finally {
      requestFrame.mockRestore()
      cancelFrame.mockRestore()
    }
  })

  it('restores the top of the dialog whenever it reopens', async () => {
    const remote = vi.fn(async () => fixtureResult())
    renderReact(<DshShareHeaderAction {...props(remote)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await loadPreview()
    const initialContent = document.querySelector<HTMLElement>('.dsh-local-share-content')
    expect(initialContent).not.toBeNull()
    initialContent!.scrollTop = 96

    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await loadPreview()
    const reopenedContent = document.querySelector<HTMLElement>('.dsh-local-share-content')
    expect(reopenedContent?.scrollTop).toBe(0)
  })

  it('shows a Remote failure and keeps export actions disabled', async () => {
    const remote = vi.fn(async () => { throw new Error('dsh-local-share: unable to read this Session') })
    renderReact(<DshShareHeaderAction {...props(remote)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('dsh-local-share: unable to read this Session')
    expect(screen.getByRole('button', { name: 'Copy source' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled()
  })

  it('regenerates every option, reports copy refusal, downloads, and closes', async () => {
    browserActions.write.mockResolvedValue(false)
    const remote = vi.fn(async (_request: ShareRequest) => fixtureResult())
    renderReact(<DshShareHeaderAction {...props(remote)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await loadPreview()

    fireEvent.click(screen.getByLabelText('Single-file HTML'))
    await waitFor(() => { expect(remote).toHaveBeenCalledTimes(2) })
    await loadPreview()
    fireEvent.click(screen.getByLabelText('Markdown'))
    await waitFor(() => { expect(remote).toHaveBeenCalledTimes(3) })
    await loadPreview()
    fireEvent.click(screen.getByLabelText('Include tool calls (arguments and outcome)'))
    await waitFor(() => { expect(remote).toHaveBeenCalledTimes(4) })
    await loadPreview()

    fireEvent.click(screen.getByRole('button', { name: 'Copy source' }))
    await screen.findByRole('button', { name: 'Copy failed' })
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(browserActions.download).toHaveBeenCalledWith(expect.objectContaining({ content: '# Shared' }))

    const closeButtons = screen.getAllByRole('button', { name: 'Close' })
    fireEvent.click(closeButtons.at(-1)!)
    expect(screen.queryByRole('dialog', { name: 'Share Session' })).not.toBeInTheDocument()
  })

  it('uses localized fallback copy for a non-Error rejection', async () => {
    const remote = vi.fn(async () => { throw 'wire disconnected' })
    renderReact(<DshShareHeaderAction {...props(remote)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not generate the share file.')
  })
})
