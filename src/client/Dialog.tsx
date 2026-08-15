/** Session Header action and privacy-gated Share dialog. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import {
  Button,
  IconCopyOutline16,
  IconDownloadOutline16,
  IconShareOutline16,
  Modal,
  writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ShareFormat, ShareRequest, ShareResult, ShareWarning } from '../contract.ts'
import { downloadShare } from './download.ts'
import { NS } from './locales.ts'

/** Browser operation injected into the Session-scoped slot contribution. */
export interface DshShareInjected {
  render: (request: ShareRequest, signal?: AbortSignal) => Promise<ShareResult>
}

/** Complete props synthesized by the Session Header slot renderer. */
export type DshShareProps = PropsRuntime<'conversation.session.header.utilities'>
  & PropsLocale<typeof NS>
  & InjectFace<DshShareInjected>

type CopyState = 'idle' | 'copied' | 'failed'

interface RenderedShare {
  generation: number
  requestKey: string
  value: ShareResult
}

function warningKey(warning: ShareWarning): `warning.${ShareWarning}` {
  return `warning.${warning}`
}

/** Render one Session's Share action and controlled dialog. */
export function DshShareHeaderAction({ sessionId, render, t }: DshShareProps): ReactNode {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<ShareFormat>('markdown')
  const [includeTools, setIncludeTools] = useState(false)
  const [redact, setRedact] = useState(true)
  const [acknowledged, setAcknowledged] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rendered, setRendered] = useState<RenderedShare>()
  const [error, setError] = useState<string>()
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const nextGeneration = useRef(0)
  const activeGeneration = useRef<number>()
  const previewReadyFrame = useRef<number>()
  const dialogBodyAnchor = useRef<HTMLDivElement>(null)
  const resetScrollOnPreviewLoad = useRef(false)
  const requestKey = `${String(sessionId)}\u0000${format}\u0000${includeTools ? 'tools' : 'messages'}\u0000${redact ? 'redacted' : 'unredacted'}`
  const result = rendered?.requestKey === requestKey ? rendered.value : undefined
  const previewUpdating = loading || (open && result === undefined && error === undefined)

  useLayoutEffect(() => {
    if (!open) return
    const scrollContainer = dialogBodyAnchor.current?.closest<HTMLElement>('.dsh-local-share-content')
    if (scrollContainer !== undefined && scrollContainer !== null) scrollContainer.scrollTop = 0
  }, [open])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const generation = nextGeneration.current + 1
    nextGeneration.current = generation
    activeGeneration.current = generation
    setLoading(true)
    setError(undefined)
    setCopyState('idle')
    void render({
      sessionId: String(sessionId),
      format,
      includeTools,
      redact,
    }, controller.signal).then(value => {
      if (controller.signal.aborted || activeGeneration.current !== generation) return
      setRendered({ generation, requestKey, value })
    }).catch((reason: unknown) => {
      if (controller.signal.aborted || activeGeneration.current !== generation) return
      setError(reason instanceof Error ? reason.message : t('error'))
      setLoading(false)
    })
    return () => {
      controller.abort()
      if (activeGeneration.current === generation) activeGeneration.current = undefined
      if (previewReadyFrame.current !== undefined) {
        cancelAnimationFrame(previewReadyFrame.current)
        previewReadyFrame.current = undefined
      }
    }
  }, [format, includeTools, open, redact, render, requestKey, sessionId, t])

  const invalidatePreview = (): void => {
    activeGeneration.current = undefined
    if (previewReadyFrame.current !== undefined) {
      cancelAnimationFrame(previewReadyFrame.current)
      previewReadyFrame.current = undefined
    }
    setLoading(true)
  }
  const show = (): void => {
    invalidatePreview()
    setFormat('markdown')
    setIncludeTools(false)
    setRedact(true)
    setAcknowledged(false)
    resetScrollOnPreviewLoad.current = true
    setRendered(undefined)
    setError(undefined)
    setOpen(true)
  }
  const close = (): void => { invalidatePreview(); setOpen(false) }
  const changeRedaction = (enabled: boolean): void => {
    setRedact(enabled)
    setAcknowledged(false)
  }
  const allowed = result !== undefined && !previewUpdating && (redact || acknowledged)
  const finishPreview = (generation: number): void => {
    if (activeGeneration.current !== generation || rendered?.generation !== generation || rendered.requestKey !== requestKey) return
    if (previewReadyFrame.current !== undefined) cancelAnimationFrame(previewReadyFrame.current)
    previewReadyFrame.current = requestAnimationFrame(() => {
      previewReadyFrame.current = undefined
      if (activeGeneration.current !== generation) return
      setLoading(false)
      if (resetScrollOnPreviewLoad.current) {
        previewReadyFrame.current = requestAnimationFrame(() => {
          previewReadyFrame.current = undefined
          if (activeGeneration.current !== generation) return
          resetScrollOnPreviewLoad.current = false
          const scrollContainer = dialogBodyAnchor.current?.closest<HTMLElement>('.dsh-local-share-content')
          if (scrollContainer !== undefined && scrollContainer !== null) scrollContainer.scrollTop = 0
        })
      }
    })
  }
  const copy = (): void => {
    if (!allowed || result === undefined) return
    void writeClipboard(result.content).then(copied => {
      setCopyState(copied ? 'copied' : 'failed')
    })
  }
  const download = (): void => {
    if (!allowed || result === undefined) return
    downloadShare(result)
  }

  return (
    <>
      <button type="button" className="dsh-local-share-action" onClick={show}>
        <span>{t('action')}</span>
        <IconShareOutline16 size={12} />
      </button>
      <Modal
        open={open}
        onClose={close}
        title={t('title')}
        description={t('description')}
        closeLabel={t('close')}
        className="dsh-local-share-dialog"
        contentClassName="dsh-local-share-content"
        footer={(
          <div className="dsh-local-share-footer">
            <Button variant="outline" onClick={close}>{t('close')}</Button>
            <Button
              variant="outline"
              icon={<IconCopyOutline16 />}
              disabled={!allowed}
              onClick={copy}
            >
              {copyState === 'copied' ? t('copied') : copyState === 'failed' ? t('copyFailed') : t('copy')}
            </Button>
            <Button
              variant="primary"
              icon={<IconDownloadOutline16 />}
              disabled={!allowed}
              onClick={download}
            >
              {t('download')}
            </Button>
          </div>
        )}
      >
        <div ref={dialogBodyAnchor} className="dsh-local-share-options">
          <fieldset className="dsh-local-share-fieldset">
            <legend className="dsh-local-share-legend">{t('format')}</legend>
            <label className="dsh-local-share-choice">
              <input
                type="radio"
                name={`dsh-local-share-format-${String(sessionId)}`}
                checked={format === 'markdown'}
                onChange={() => { invalidatePreview(); setFormat('markdown') }}
              />
              <span>{t('markdown')}</span>
            </label>
            <label className="dsh-local-share-choice">
              <input
                type="radio"
                name={`dsh-local-share-format-${String(sessionId)}`}
                checked={format === 'html'}
                onChange={() => { invalidatePreview(); setFormat('html') }}
              />
              <span>{t('html')}</span>
            </label>
          </fieldset>
          <div>
            <label className="dsh-local-share-check">
              <input
                type="checkbox"
                checked={includeTools}
                onChange={event => { invalidatePreview(); setIncludeTools(event.currentTarget.checked) }}
              />
              <span>{t('includeTools')}</span>
            </label>
            <label className="dsh-local-share-check">
              <input
                type="checkbox"
                checked={redact}
                onChange={event => { invalidatePreview(); changeRedaction(event.currentTarget.checked) }}
              />
              <span>{t('redact')}</span>
            </label>
          </div>
          <div className="dsh-local-share-risk-slot">
            <div
              className={`dsh-local-share-safe-note${redact ? '' : ' dsh-local-share-safe-note-hidden'}`}
              aria-hidden={!redact}
            >
              {t('redactionSummary')}
            </div>
            <label
              className={`dsh-local-share-check dsh-local-share-risk${redact ? ' dsh-local-share-risk-hidden' : ''}`}
              aria-hidden={redact}
            >
              <input
                type="checkbox"
                checked={acknowledged}
                disabled={redact}
                tabIndex={redact ? -1 : undefined}
                onChange={event => { setAcknowledged(event.currentTarget.checked) }}
              />
              <span>{t('acknowledgement')}</span>
            </label>
          </div>
        </div>
        <div className="dsh-local-share-preview-head">
          <span className="dsh-local-share-preview-title">{t('preview')}</span>
          {result !== undefined && (
            <span className="dsh-local-share-stats">
              {t('stats', {
                messages: result.stats.messages,
                tools: result.stats.toolCalls,
                redactions: result.stats.redactions,
              })}
            </span>
          )}
        </div>
        <div className="dsh-local-share-preview-shell">
          {rendered !== undefined && (
            <iframe
              key={rendered.generation}
              className="dsh-local-share-frame"
              title={t('preview')}
              sandbox=""
              srcDoc={rendered.value.previewHtml}
              onLoad={() => { finishPreview(rendered.generation) }}
            />
          )}
          <div
            className={`dsh-local-share-preview-overlay${previewUpdating || error !== undefined ? ' dsh-local-share-preview-overlay-visible' : ''}${error !== undefined ? ' dsh-local-share-preview-overlay-error' : ''}`}
            aria-hidden={!previewUpdating && error === undefined}
          >
            {previewUpdating && (
              <div className="dsh-local-share-loading" role="status">
                <span className="dsh-local-share-spinner" aria-hidden="true" />
                <span>{t('loading')}</span>
              </div>
            )}
            {error !== undefined && <div className="dsh-local-share-error" role="alert">{error}</div>}
          </div>
        </div>
        <ul className="dsh-local-share-warnings">
          {result?.warnings.map(warning => <li key={warning}>{t(warningKey(warning))}</li>)}
        </ul>
      </Modal>
    </>
  )
}

/** Narrow SessionId import retained for declaration consumers. */
export type { SessionId }
