import type { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

/** Shared router context assembled at the renderer root. */
export interface RootContext {
	readonly rendererRuntime: typeof RendererRuntime;
}
