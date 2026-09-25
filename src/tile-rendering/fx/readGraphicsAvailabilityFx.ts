import { Effect } from "effect";
import { isWebGLSupported, isWebGPUSupported } from "pixi.js";

/** Checks the same GPU backends admitted by the Board before Launcher startup. */
export const readGraphicsAvailabilityFx = Effect.fn("readGraphicsAvailabilityFx")(() =>
	Effect.suspend(() =>
		isWebGLSupported() ? Effect.succeed(true) : Effect.promise(() => isWebGPUSupported()),
	),
);
