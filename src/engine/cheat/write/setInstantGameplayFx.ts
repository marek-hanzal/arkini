import { Effect } from "effect";

import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace setInstantGameplayFx {
	export interface Props {
		readonly enabled: boolean;
	}
}

/** Atomically changes the persisted Instant gameplay option. */
export const setInstantGameplayFx = Effect.fn("setInstantGameplayFx")(function* ({
	enabled,
}: setInstantGameplayFx.Props) {
	return yield* modifyRuntimeFx((runtime) => {
		if (runtime.cheats.instantGameplay === enabled) {
			return Effect.succeed([
				runtime.cheats,
				runtime,
			] as const);
		}
		const cheats = {
			...runtime.cheats,
			instantGameplay: enabled,
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
