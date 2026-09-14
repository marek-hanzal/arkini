import { Effect } from "effect";

import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace setSpeedUpGameplayFx {
	export interface Props {
		readonly enabled: boolean;
	}
}

/** Atomically changes the persisted Speed up option. */
export const setSpeedUpGameplayFx = Effect.fn("setSpeedUpGameplayFx")(function* ({
	enabled,
}: setSpeedUpGameplayFx.Props) {
	const cheats = yield* modifyRuntimeFx((runtime) => {
		if (runtime.cheats.speedUpGameplay === enabled) {
			return Effect.succeed([
				runtime.cheats,
				runtime,
			] as const);
		}
		const cheats = {
			...runtime.cheats,
			speedUpGameplay: enabled,
		};
		return Effect.succeed([
			cheats,
			{
				...runtime,
				cheats,
			} satisfies RuntimeSchema.Type,
		] as const);
	});
	return cheats;
});
