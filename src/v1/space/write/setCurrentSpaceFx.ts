import { Effect } from "effect";

import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import type { CurrentSpaceChangedGameEventSchema } from "~/v1/event/schema/CurrentSpaceChangedGameEventSchema";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { SpaceInvalidError } from "~/v1/space/error/SpaceInvalidError";

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
				type: "current-space:changed",
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
