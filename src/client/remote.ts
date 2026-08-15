/** Client Typert contribution for the strict `dshLocalShare` namespace. */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { DSH_SHARE_INVOCATIONS } from '../contract.ts'
import type { ShareRequest, ShareResult } from '../contract.ts'

/** Descriptor set mounted into the browser Gateway client. */
export const DSH_SHARE_REMOTE: TypertRemoteContribution = {
  package: 'dsh-local-share',
  descriptors: DSH_SHARE_INVOCATIONS,
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  /** Mounted browser face for DSH Local Share. */
  interface TypertRemoteNamespace$6473684c6f63616c5368617265 {
    render: (request: ShareRequest, signal?: AbortSignal) => Promise<RemoteResult<ShareResult>>
  }
  interface TypertRemoteMap {
    'dshLocalShare/render': (request: ShareRequest, signal?: AbortSignal) => Promise<RemoteResult<ShareResult>>
  }
  interface TypertRemoteNamespaceMap {
    dshLocalShare: TypertRemoteNamespace$6473684c6f63616c5368617265
  }
}
