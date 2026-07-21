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
export const fromStateFx = Effect.fn("fromStateFx")(function* ({ state }: fromStateFx.Props) {
	const items = yield* Effect.forEach(state.items, (state) =>
		fromStateItemFx({
			state,
		}),
	);
	return yield* assertRuntimeFx({
		runtime: {
			currentSpace: state.currentSpace,
			session: {
				speedMode: "normal" as const,
			},
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
