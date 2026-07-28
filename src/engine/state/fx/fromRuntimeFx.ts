import { Effect } from "effect";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { fromRuntimeItemFx } from "./fromRuntimeItemFx";
export namespace fromRuntimeFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Projects one hydrated runtime into serializable gameplay state.
 *
 * Runtime-only canonical objects and optimistic revisions are intentionally
 * omitted; hydration will resolve item definitions and mint new revisions for
 * the next session.
 */
export const fromRuntimeFx = Effect.fn("fromRuntimeFx")(function* ({
	runtime,
}: fromRuntimeFx.Props) {
	const items = yield* Effect.forEach(runtime.items, (item) =>
		fromRuntimeItemFx({
			item,
		}),
	);
	return {
		cheats: {
			...runtime.cheats,
		},
		currentSpace: runtime.currentSpace,
		items,
		jobs: runtime.jobs,
		jobQueue: runtime.jobQueue ?? [],
		...(runtime.deliveryStartIntents === undefined
			? {}
			: {
					deliveryStartIntents: runtime.deliveryStartIntents.map((intent) => ({
						...intent,
					})),
				}),
		...(runtime.autonomousLines === undefined
			? {}
			: {
					autonomousLines: runtime.autonomousLines.map((line) => ({
						...line,
					})),
				}),
		...(runtime.defaultLineByOwnerItemId === undefined
			? {}
			: {
					defaultLineByOwnerItemId: {
						...runtime.defaultLineByOwnerItemId,
					},
				}),
	} satisfies StateSchema.Type;
});
