import type { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Shared router context assembled at the renderer root. */
export interface RootContext {
	readonly rendererRuntime: typeof RendererRuntime;
}
