import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { RendererLifecycleOwnerAtom } from "~/application-runtime/atom/RendererLifecycleOwnerAtom";
import { createRendererLifecycleFx } from "~/application-runtime/fx/createRendererLifecycleFx";

/** Adapts and publishes the renderer process's one native lifecycle capability. */
export const bootstrapRendererLifecycleFx = Effect.fn("bootstrapRendererLifecycleFx")(function* (
	lifecycleApi: Pick<
		ArkiniElectronApi.Api["lifecycle"],
		"forceCloseFn" | "requestCloseFn" | "waitUntilVisibleFn"
	>,
) {
	const lifecycle = yield* createRendererLifecycleFx(lifecycleApi);
	yield* Atom.set(RendererLifecycleOwnerAtom, lifecycle);
	return lifecycle;
});
