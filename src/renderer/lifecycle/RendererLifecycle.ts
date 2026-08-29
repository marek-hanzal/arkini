import type { Effect } from "effect";
import type { RendererLifecycleError } from "~/renderer/lifecycle/RendererLifecycleError";

/** Effect-native renderer access to the narrow Electron lifecycle capability. */
export interface RendererLifecycle {
	readonly forceCloseFx: Effect.Effect<void, RendererLifecycleError>;
	readonly requestCloseFx: Effect.Effect<void, RendererLifecycleError>;
	readonly waitUntilVisibleFx: Effect.Effect<number, RendererLifecycleError>;
}
