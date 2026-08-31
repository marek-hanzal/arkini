import { Data, Effect } from "effect";
import type { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";

type RendererLifecycleOperation = "force-close" | "request-close" | "wait-until-visible";

class RendererLifecycleError extends Data.TaggedError("RendererLifecycleError")<{
	readonly operation: RendererLifecycleOperation;
	readonly cause: unknown;
}> {
	override get message(): string {
		const causeMessage = this.cause instanceof Error ? this.cause.message : String(this.cause);
		return `Renderer lifecycle failed during ${this.operation}: ${causeMessage}`;
	}
}

/** Effect-native renderer access to the narrow Electron lifecycle capability. */
export interface RendererLifecycle {
	readonly forceCloseFx: Effect.Effect<void, RendererLifecycleError, never>;
	readonly requestCloseFx: Effect.Effect<void, RendererLifecycleError, never>;
	readonly waitUntilVisibleFx: Effect.Effect<number, RendererLifecycleError, never>;
}

/**
 * Adapts only the pure preload contract into Effect. Renderer lifecycle callers
 * must not reach into Electron main/preload runtime modules behind this seam.
 */
export const createRendererLifecycleFx = Effect.fn("createRendererLifecycleFx")(
	(
		api: Pick<
			ArkiniElectronApi.Api["lifecycle"],
			"forceCloseFn" | "requestCloseFn" | "waitUntilVisibleFn"
		>,
	) =>
		Effect.succeed<RendererLifecycle>({
			forceCloseFx: Effect.try({
				try: () => api.forceCloseFn(),
				catch: (cause) =>
					new RendererLifecycleError({
						operation: "force-close",
						cause,
					}),
			}),
			requestCloseFx: Effect.tryPromise({
				try: () => api.requestCloseFn(),
				catch: (cause) =>
					new RendererLifecycleError({
						operation: "request-close",
						cause,
					}),
			}),
			waitUntilVisibleFx: Effect.tryPromise({
				try: () => api.waitUntilVisibleFn(),
				catch: (cause) =>
					new RendererLifecycleError({
						operation: "wait-until-visible",
						cause,
					}),
			}),
		}),
);
