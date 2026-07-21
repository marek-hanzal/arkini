import { Effect } from "effect";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { fromRuntimeItemFx } from "./fromRuntimeItemFx";
export namespace fromRuntimeFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}
export const fromRuntimeFx = Effect.fn("fromRuntimeFx")(function* ({
	runtime,
}: fromRuntimeFx.Props) {
	const items = yield* Effect.forEach(runtime.items, (item) =>
		fromRuntimeItemFx({
			item,
		}),
	);
	return {
		currentSpace: runtime.currentSpace,
		items,
		jobs: runtime.jobs,
		jobQueue: runtime.jobQueue ?? [],
		...(runtime.defaultLineByOwnerItemId === undefined
			? {}
			: {
					defaultLineByOwnerItemId: {
						...runtime.defaultLineByOwnerItemId,
					},
				}),
	} satisfies StateSchema.Type;
});
