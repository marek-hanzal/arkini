import { Effect } from "effect";

import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace setCheatEnabledFx {
	export interface Props {
		readonly enabled: boolean;
	}
}

/** Atomically changes persisted Cheat mode without altering stored cheat options. */
export const setCheatEnabledFx = Effect.fn("setCheatEnabledFx")(function* ({
	enabled,
}: setCheatEnabledFx.Props) {
	return yield* modifyRuntimeFx((runtime) => {
		if (runtime.cheats.enabled === enabled) {
			return Effect.succeed([
				runtime.cheats,
				runtime,
			] as const);
		}
		const cheats = {
			...runtime.cheats,
			enabled,
		};
		return Effect.succeed([
			cheats,
			{
				...runtime,
				cheats,
			} satisfies RuntimeSchema.Type,
		] as const);
	});
});
