/** Browser plugin that mounts the Remote and contributes the Share header action. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type DshShareLocaleKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'dsh-share': DshShareLocaleKey;
    }
}
/** Required browser services. */
export declare const inject: string[];
/** Compose dictionaries, Remote binding, styles, and Session Header entry. */
export declare function apply(ctx: ClientContext): void;
export type { DshShareInjected, DshShareProps } from './Dialog.tsx';
