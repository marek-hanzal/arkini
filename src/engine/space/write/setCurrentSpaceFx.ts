import { Effect } from "effect";

import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { CurrentSpaceChangedGameEventSchema } from "~/engine/event/schema/CurrentSpaceChangedGameEventSchema";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { SpaceInvalidError } from "~/engine/space/error/SpaceInvalidError";

export namespace setCurrentSpaceFx {
	export interface Props {
		space: NonNegativeIntegerSchema.Type;
	}
}

/** Atomically changes persistent board navigation without affecting simulation. */
export const setCurrentSpaceFx = Effect.fn("setCurrentSpaceFx")(function* ({
	space,
}: setCurrentSpaceFx.Props) {
	if (!Number.isInteger(space) || space < 0) {
		return yield* Effect.fail(
			new SpaceInvalidError({
				space,
			}),
		);
	}

	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			if (runtime.currentSpace === space) {
				return [
					space,
					runtime,
				] as const;
			}

			const event = {
				type: GameEventEnumSchema.enum.CurrentSpaceChanged,
				previousSpace: runtime.currentSpace,
				currentSpace: space,
			} satisfies CurrentSpaceChangedGameEventSchema.Type;
			const nextRuntime = {
				...runtime,
				currentSpace: space,
			} satisfies RuntimeSchema.Type;

			return [
				space,
				nextRuntime,
				[
					event,
				],
			] as const;
		}),
	);
});
