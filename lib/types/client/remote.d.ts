/** Client Typert contribution for the strict `dshShare` namespace. */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { ShareRequest, ShareResult } from '../contract.ts';
/** Descriptor set mounted into the browser Gateway client. */
export declare const DSH_SHARE_REMOTE: TypertRemoteContribution;
declare module '@deepseek-ai/dsh-typert-protocol' {
    /** Mounted browser face for DSH Share. */
    interface TypertRemoteNamespace$6473685368617265 {
        render: (request: ShareRequest, signal?: AbortSignal) => Promise<RemoteResult<ShareResult>>;
    }
    interface TypertRemoteMap {
        'dshShare/render': (request: ShareRequest, signal?: AbortSignal) => Promise<RemoteResult<ShareResult>>;
    }
    interface TypertRemoteNamespaceMap {
        dshShare: TypertRemoteNamespace$6473685368617265;
    }
}
