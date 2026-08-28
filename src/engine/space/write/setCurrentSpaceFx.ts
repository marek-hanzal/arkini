import { Effect } from "effect";

import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { SpaceInvalidError } from "~/engine/space/error/SpaceInvalidError";
import { setCurrentSpaceRuntimeFx } from "~/engine/space/internal/setCurrentSpaceRuntimeFx";

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
			const transition = yield* setCurrentSpaceRuntimeFx({
				runtime,
				space,
			});
			return [
				space,
				transition.runtime,
				transition.events,
			] as const;
		}),
	);
});
