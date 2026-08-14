/** Session Header action and privacy-gated Share dialog. */
import { useEffect, useState } from 'react'
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
  const requestKey = `${String(sessionId)}\u0000${format}\u0000${includeTools ? 'tools' : 'messages'}\u0000${redact ? 'redacted' : 'unredacted'}`
  const result = rendered?.requestKey === requestKey ? rendered.value : undefined

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoading(true)
    setRendered(undefined)
    setError(undefined)
    setCopyState('idle')
    void render({
      sessionId: String(sessionId),
      format,
      includeTools,
      redact,
    }, controller.signal).then(value => {
      if (controller.signal.aborted) return
      setRendered({ requestKey, value })
      setLoading(false)
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return
      setError(reason instanceof Error ? reason.message : t('error'))
      setLoading(false)
    })
    return () => { controller.abort() }
  }, [format, includeTools, open, redact, render, requestKey, sessionId, t])

  const show = (): void => {
    setFormat('markdown')
    setIncludeTools(false)
    setRedact(true)
    setAcknowledged(false)
    setOpen(true)
  }
  const close = (): void => { setOpen(false) }
  const changeRedaction = (enabled: boolean): void => {
    setRedact(enabled)
    setAcknowledged(false)
  }
  const allowed = result !== undefined && !loading && (redact || acknowledged)
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
      <button type="button" className="dsh-share-action" onClick={show}>
        <span>{t('action')}</span>
        <IconShareOutline16 size={12} />
      </button>
      <Modal
        open={open}
        onClose={close}
        title={t('title')}
        description={t('description')}
        closeLabel={t('close')}
        className="dsh-share-dialog"
        contentClassName="dsh-share-content"
        footer={(
          <div className="dsh-share-footer">
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
        <div className="dsh-share-options">
          <fieldset className="dsh-share-fieldset">
            <legend className="dsh-share-legend">{t('format')}</legend>
            <label className="dsh-share-choice">
              <input
                type="radio"
                name={`dsh-share-format-${String(sessionId)}`}
                checked={format === 'markdown'}
                onChange={() => { setFormat('markdown') }}
              />
              <span>{t('markdown')}</span>
            </label>
            <label className="dsh-share-choice">
              <input
                type="radio"
                name={`dsh-share-format-${String(sessionId)}`}
                checked={format === 'html'}
                onChange={() => { setFormat('html') }}
              />
              <span>{t('html')}</span>
            </label>
          </fieldset>
          <div>
            <label className="dsh-share-check">
              <input
                type="checkbox"
                checked={includeTools}
                onChange={event => { setIncludeTools(event.currentTarget.checked) }}
              />
              <span>{t('includeTools')}</span>
            </label>
            <label className="dsh-share-check">
              <input
                type="checkbox"
                checked={redact}
                onChange={event => { changeRedaction(event.currentTarget.checked) }}
              />
              <span>{t('redact')}</span>
            </label>
          </div>
          {!redact && (
            <label className="dsh-share-check dsh-share-risk">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={event => { setAcknowledged(event.currentTarget.checked) }}
              />
              <span>{t('acknowledgement')}</span>
            </label>
          )}
        </div>
        <div className="dsh-share-preview-head">
          <span className="dsh-share-preview-title">{t('preview')}</span>
          {result !== undefined && (
            <span className="dsh-share-stats">
              {t('stats', {
                messages: result.stats.messages,
                tools: result.stats.toolCalls,
                redactions: result.stats.redactions,
              })}
            </span>
          )}
        </div>
        {loading && <div className="dsh-share-placeholder" role="status">{t('loading')}</div>}
        {!loading && error !== undefined && <div className="dsh-share-placeholder dsh-share-error" role="alert">{error}</div>}
        {!loading && error === undefined && result !== undefined && (
          <iframe
            className="dsh-share-frame"
            title={t('preview')}
            sandbox=""
            srcDoc={result.previewHtml}
          />
        )}
        {result !== undefined && (
          <ul className="dsh-share-warnings">
            {result.warnings.map(warning => <li key={warning}>{t(warningKey(warning))}</li>)}
          </ul>
        )}
      </Modal>
    </>
  )
}

/** Narrow SessionId import retained for declaration consumers. */
export type { SessionId }
