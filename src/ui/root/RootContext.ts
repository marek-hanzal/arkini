import type { RendererRuntime } from "~/renderer/RendererRuntime";

/** Shared router context assembled at the renderer root. */
export interface RootContext {
	readonly rendererRuntime: typeof RendererRuntime;
}
