import { Effect } from "effect";

import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { settleInstantGameplayFx } from "~/engine/cheat/write/settleInstantGameplayFx";

export namespace setCheatEnabledFx {
	export interface Props {
		readonly enabled: boolean;
	}
}

/** Atomically changes persisted Cheat mode and permanently records first enablement. */
export const setCheatEnabledFx = Effect.fn("setCheatEnabledFx")(function* ({
	enabled,
}: setCheatEnabledFx.Props) {
	const cheats = yield* modifyRuntimeFx((runtime) => {
		if (runtime.cheats.enabled === enabled) {
			return Effect.succeed([
				runtime.cheats,
				runtime,
			] as const);
		}
		const cheats = {
			...runtime.cheats,
			enabled,
			everEnabled: runtime.cheats.everEnabled || enabled,
		};
		return Effect.succeed([
			cheats,
			{
				...runtime,
				cheats,
			} satisfies RuntimeSchema.Type,
		] as const);
	});
	if (enabled && cheats.instantGameplay) yield* settleInstantGameplayFx();
	return cheats;
});
