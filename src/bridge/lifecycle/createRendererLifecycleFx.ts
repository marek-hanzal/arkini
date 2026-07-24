import { Effect } from "effect";
import type { ArkiniElectronApi } from "../../../electron/contract/ArkiniElectronApi";
import type { RendererLifecycle } from "~/bridge/lifecycle/RendererLifecycle";
import { RendererLifecycleError } from "~/bridge/lifecycle/RendererLifecycleError";

export const createRendererLifecycleFx = Effect.fn("createRendererLifecycleFx")(
	(
		api: Pick<
			ArkiniElectronApi.Api["lifecycle"],
			"forceClose" | "requestClose" | "waitUntilVisible"
		>,
	) =>
		Effect.succeed<RendererLifecycle>({
			forceCloseFx: Effect.try({
				try: () => api.forceClose(),
				catch: (cause) =>
					new RendererLifecycleError({
						operation: "force-close",
						cause,
					}),
			}),
			requestCloseFx: Effect.tryPromise({
				try: () => api.requestClose(),
				catch: (cause) =>
					new RendererLifecycleError({
						operation: "request-close",
						cause,
					}),
			}),
			waitUntilVisibleFx: Effect.tryPromise({
				try: () => api.waitUntilVisible(),
				catch: (cause) =>
					new RendererLifecycleError({
						operation: "wait-until-visible",
						cause,
					}),
			}),
		}),
);
