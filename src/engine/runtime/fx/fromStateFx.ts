import { Effect } from "effect";
import { assertRuntimeFx } from "~/engine/runtime/check/assertRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { fromStateItemFx } from "./fromStateItemFx";
export namespace fromStateFx {
	export interface Props {
		state: StateSchema.Type;
	}
}

/**
 * Hydrates serializable state into one validated runtime.
 *
 * Canonical item definitions are rebound from the loaded config and every item
 * receives a fresh session revision. Persisted identities and job ownership stay
 * stable, but stale command tokens cannot survive a save/load boundary.
 */
export const fromStateFx = Effect.fn("fromStateFx")(function* ({ state }: fromStateFx.Props) {
	const items = yield* Effect.forEach(state.items, (state) =>
		fromStateItemFx({
			state,
		}),
	);
	return yield* assertRuntimeFx({
		runtime: {
			cheats: {
				...state.cheats,
			},
			currentSpace: state.currentSpace,
			items,
			jobs: state.jobs,
			jobQueue: state.jobQueue ?? [],
			...(state.defaultLineByOwnerItemId === undefined
				? {}
				: {
						defaultLineByOwnerItemId: {
							...state.defaultLineByOwnerItemId,
						},
					}),
		} satisfies RuntimeSchema.Type,
	});
});
