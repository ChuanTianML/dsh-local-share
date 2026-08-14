/** DSH Share Host plugin: Session projection service and strict Typert manifest. */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Cordis plugin and client module id. */
export declare const name = "dsh-share";
/** Services required before the Host plugin loads. */
export declare const inject: string[];
/** Maximum raw events accepted by default. */
export declare const DEFAULT_MAX_EVENTS = 20000;
/** Maximum characters accepted in either generated output by default. */
export declare const DEFAULT_MAX_OUTPUT_CHARS = 2000000;
/** Maximum arguments retained for one enabled tool call by default. */
export declare const DEFAULT_MAX_TOOL_ARGUMENT_CHARS = 12000;
/** Deployment-varying Host limits. */
export interface Config {
    /** Maximum raw events read from one Session. */
    maxEvents?: number;
    /** Maximum characters in a generated file or preview. */
    maxOutputChars?: number;
    /** Maximum argument characters retained per enabled tool call. */
    maxToolArgumentChars?: number;
}
/** Configuration schema with positive-integer defaults. */
export declare const Config: z<Schemastery.ObjectS<{
    maxEvents: z<number, number>;
    maxOutputChars: z<number, number>;
    maxToolArgumentChars: z<number, number>;
}>, Schemastery.ObjectT<{
    maxEvents: z<number, number>;
    maxOutputChars: z<number, number>;
    maxToolArgumentChars: z<number, number>;
}>>;
/**
 * Mount the share service and strict wire manifest.
 * @param ctx - Host Cordis context.
 * @param config - validated deployment limits.
 */
export declare function apply(ctx: Context, config?: Config): void;
export type { ShareRequest, ShareResult, ShareWarning } from './contract.ts';
export { DshShareRuntime } from './runtime.ts';
export { ShareRenderError, renderShare } from './render.ts';
