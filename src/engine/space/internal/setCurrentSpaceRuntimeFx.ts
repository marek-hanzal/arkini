import { Effect } from "effect";

import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { CurrentSpaceChangedGameEventSchema } from "~/engine/event/schema/CurrentSpaceChangedGameEventSchema";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Applies canonical space navigation to one explicit runtime transaction draft. */
export const setCurrentSpaceRuntimeFx = Effect.fn("setCurrentSpaceRuntimeFx")(function* ({
	runtime,
	space,
}: {
	runtime: RuntimeSchema.Type;
	space: NonNegativeIntegerSchema.Type;
}) {
	if (runtime.currentSpace === space) {
		return {
			events: [] as CurrentSpaceChangedGameEventSchema.Type[],
			runtime,
		};
	}
	return {
		events: [
			{
				type: GameEventEnumSchema.enum.CurrentSpaceChanged,
				previousSpace: runtime.currentSpace,
				currentSpace: space,
			} satisfies CurrentSpaceChangedGameEventSchema.Type,
		],
		runtime: {
			...runtime,
			currentSpace: space,
		} satisfies RuntimeSchema.Type,
	};
});
