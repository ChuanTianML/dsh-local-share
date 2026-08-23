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
import type { ShareFormat, ShareRequest, ShareResult, ShareTurn, ShareWarning } from '../contract.ts'
import { downloadBlob, downloadShare } from './download.ts'
import { captureLongImage, copyLongImage, longImageFilename } from './long-image.ts'
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
type ShareOutputFormat = ShareFormat | 'png'
type ImageState = 'idle' | 'working' | 'failed'

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
  const [format, setFormat] = useState<ShareOutputFormat>('markdown')
  const [includeTools, setIncludeTools] = useState(false)
  const [redact, setRedact] = useState(true)
  const [selectedTurnSeqs, setSelectedTurnSeqs] = useState<readonly number[] | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rendered, setRendered] = useState<RenderedShare>()
  const [error, setError] = useState<string>()
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [imageState, setImageState] = useState<ImageState>('idle')
  const nextGeneration = useRef(0)
  const activeGeneration = useRef<number>()
  const previewReadyFrame = useRef<number>()
  const dialogBodyAnchor = useRef<HTMLDivElement>(null)
  const previewFrame = useRef<HTMLIFrameElement>(null)
  const imageCache = useRef<{ generation: number; blob: Blob }>()
  const exportAuthorized = useRef(false)
  const resetScrollOnPreviewLoad = useRef(false)
  const selectionKey = selectedTurnSeqs === null ? 'all' : selectedTurnSeqs.join(',')
  const requestKey = `${String(sessionId)}\u0000${format}\u0000${includeTools ? 'tools' : 'messages'}\u0000${redact ? 'redacted' : 'unredacted'}\u0000${selectionKey}`
  const wireFormat: ShareFormat = format === 'png' ? 'html' : format
  const result = rendered?.requestKey === requestKey ? rendered.value : undefined
  const availableTurns = rendered?.value.turns ?? []
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
      format: wireFormat,
      includeTools,
      redact,
      selectedTurnSeqs: selectedTurnSeqs === null ? null : [...selectedTurnSeqs],
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
  }, [includeTools, open, redact, render, requestKey, selectedTurnSeqs, sessionId, t, wireFormat])

  const invalidatePreview = (): void => {
    activeGeneration.current = undefined
    imageCache.current = undefined
    setImageState('idle')
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
    setSelectedTurnSeqs(null)
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
  const allowed = result !== undefined && !previewUpdating && imageState !== 'working' && (redact || acknowledged)
  exportAuthorized.current = allowed
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
  const generateLongImage = async (): Promise<Blob | undefined> => {
    if (result === undefined || rendered === undefined) return
    const cached = imageCache.current
    if (cached?.generation === rendered.generation) return cached.blob
    const frame = previewFrame.current
    if (frame === null) return
    const generation = rendered.generation
    setImageState('working')
    setCopyState('idle')
    try {
      const blob = await captureLongImage(frame)
      if (activeGeneration.current !== generation) return
      imageCache.current = { generation, blob }
      setImageState('idle')
      return blob
    } catch {
      if (activeGeneration.current === generation) setImageState('failed')
    }
  }
  const copy = (): void => {
    if (!allowed || result === undefined) return
    if (format === 'png') {
      void generateLongImage().then(async blob => {
        if (blob === undefined || !exportAuthorized.current) return
        const copied = await copyLongImage(blob)
        if (!exportAuthorized.current) return
        setCopyState(copied ? 'copied' : 'failed')
      })
      return
    }
    void writeClipboard(result.content).then(copied => {
      setCopyState(copied ? 'copied' : 'failed')
    })
  }
  const download = (): void => {
    if (!allowed || result === undefined) return
    if (format === 'png') {
      void generateLongImage().then(blob => {
        if (blob !== undefined && exportAuthorized.current) {
          downloadBlob(blob, longImageFilename(result.filename))
        }
      })
      return
    }
    downloadShare(result)
  }

  const isTurnSelected = (turn: ShareTurn): boolean => selectedTurnSeqs === null
    || selectedTurnSeqs.includes(turn.startSeq)
  const toggleTurn = (turn: ShareTurn): void => {
    const selected = new Set(selectedTurnSeqs ?? availableTurns.map(item => item.startSeq))
    if (selected.has(turn.startSeq)) {
      if (selected.size === 1) return
      selected.delete(turn.startSeq)
    } else {
      selected.add(turn.startSeq)
    }
    invalidatePreview()
    const ordered = availableTurns.filter(item => selected.has(item.startSeq)).map(item => item.startSeq)
    setSelectedTurnSeqs(ordered.length === availableTurns.length ? null : ordered)
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
              {imageState === 'working'
                ? t('generatingImage')
                : copyState === 'copied'
                  ? t('copied')
                  : copyState === 'failed'
                    ? t('copyFailed')
                    : format === 'png' ? t('copyImage') : t('copy')}
            </Button>
            <Button
              variant="primary"
              icon={<IconDownloadOutline16 />}
              disabled={!allowed}
              onClick={download}
            >
              {imageState === 'working'
                ? t('generatingImage')
                : format === 'png' ? t('downloadImage') : t('download')}
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
            <label className="dsh-local-share-choice">
              <input
                type="radio"
                name={`dsh-local-share-format-${String(sessionId)}`}
                checked={format === 'png'}
                onChange={() => { invalidatePreview(); setFormat('png') }}
              />
              <span>{t('longImage')}</span>
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
          {availableTurns.length > 0 && (
            <fieldset
              className="dsh-local-share-fieldset dsh-local-share-turns"
              aria-label={t('turns')}
            >
              <div className="dsh-local-share-turns-head">
                <span className="dsh-local-share-legend">{t('turns')}</span>
                <button
                  type="button"
                  className="dsh-local-share-select-all"
                  disabled={selectedTurnSeqs === null}
                  onClick={() => { invalidatePreview(); setSelectedTurnSeqs(null) }}
                >
                  {t('selectAll')}
                </button>
              </div>
              <div className="dsh-local-share-turn-list">
                {availableTurns.map((turn, index) => {
                  const selected = isTurnSelected(turn)
                  const isLastSelected = selected && selectedTurnSeqs !== null && selectedTurnSeqs.length === 1
                  return (
                    <label key={turn.startSeq} className="dsh-local-share-turn">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={isLastSelected}
                        onChange={() => { toggleTurn(turn) }}
                      />
                      <span className="dsh-local-share-turn-number">{t('turn', { number: index + 1 })}</span>
                      <span className="dsh-local-share-turn-preview">{turn.preview || t('emptyTurn')}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}
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
                turns: result.stats.turns,
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
              ref={previewFrame}
              key={rendered.generation}
              className="dsh-local-share-frame"
              title={t('preview')}
              sandbox={format === 'png' ? 'allow-same-origin' : ''}
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
          {imageState === 'failed' && <li>{t('imageError')}</li>}
        </ul>
      </Modal>
    </>
  )
}

/** Narrow SessionId import retained for declaration consumers. */
export type { SessionId }
