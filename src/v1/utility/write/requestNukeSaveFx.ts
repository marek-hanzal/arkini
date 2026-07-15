import { Effect } from "effect";

import type { NukeSaveRequestedGameEventSchema } from "~/v1/event/schema/NukeSaveRequestedGameEventSchema";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";

/** Emits one presentation request for explicit persisted-save deletion confirmation. */
export const requestNukeSaveFx = Effect.fn("requestNukeSaveFx")(function* () {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.succeed([
			undefined,
			runtime,
			[
				{
					type: "nuke-save:requested",
				} satisfies NukeSaveRequestedGameEventSchema.Type,
			],
		] as const),
	);
});
