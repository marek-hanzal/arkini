import { Effect } from "effect";

import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace isInstantGameplayEnabledFx {
	export interface Props {
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Returns whether the persisted Instant gameplay option is currently effective. */
export const isInstantGameplayEnabledFx = Effect.fn("isInstantGameplayEnabledFx")(function* ({
	runtime,
}: isInstantGameplayEnabledFx.Props) {
	return runtime.cheats.enabled && runtime.cheats.instantGameplay;
});
