import type { ReactNode } from 'react';
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ShareRequest, ShareResult } from '../contract.ts';
import { NS } from './locales.ts';
/** Browser operation injected into the Session-scoped slot contribution. */
export interface DshShareInjected {
    render: (request: ShareRequest, signal?: AbortSignal) => Promise<ShareResult>;
}
/** Complete props synthesized by the Session Header slot renderer. */
export type DshShareProps = PropsRuntime<'conversation.session.header.utilities'> & PropsLocale<typeof NS> & InjectFace<DshShareInjected>;
/** Render one Session's Share action and controlled dialog. */
export declare function DshShareHeaderAction({ sessionId, render, t }: DshShareProps): ReactNode;
/** Narrow SessionId import retained for declaration consumers. */
export type { SessionId };
