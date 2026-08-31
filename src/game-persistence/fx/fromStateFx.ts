import { Effect } from "effect";
import { assertRuntimeFx } from "~/game-runtime/fx/assertRuntimeFx";
import { resolveItemFx } from "~/item-resolution/fx/resolveItemFx";
import { createRevisionFx } from "~/item-revision/fx/createRevisionFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import type { StateItemSchema } from "~/game-persistence/schema/StateItemSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";

interface FromStateProps {
	state: StateSchema.Type;
}

const fromStateItemFx = Effect.fn("fromStateItemFx")(function* (state: StateItemSchema.Type) {
	const item = yield* resolveItemFx({
		itemId: state.itemId,
	});

	return {
		id: state.id,
		item,
		location: state.location,
		quantity: state.quantity,
		remainingCharges: state.remainingCharges,
		remainingDurationMs:
			state.remainingDurationMs ??
			(item.type === TypeSchema.enum.Temporary ? item.durationMs : undefined),
		revision: yield* createRevisionFx(),
	} satisfies RuntimeItemSchema.Type;
});

/**
 * Hydrates serializable state into one validated runtime.
 *
 * Canonical item definitions are rebound from the loaded config and every item
 * receives a fresh session revision. Persisted identities and job ownership stay
 * stable, but stale command tokens cannot survive a save/load boundary.
 */
export const fromStateFx = Effect.fn("fromStateFx")(function* ({ state }: FromStateProps) {
	const items = yield* Effect.forEach(state.items, fromStateItemFx);
	return yield* assertRuntimeFx({
		runtime: {
			cheats: {
				...state.cheats,
			},
			currentSpace: state.currentSpace,
			items,
			jobs: state.jobs,
			jobQueue: state.jobQueue,
			defaultLineByOwnerItemId: {
				...(state.defaultLineByOwnerItemId ?? {}),
			},
		} satisfies RuntimeSchema.Type,
	});
});
