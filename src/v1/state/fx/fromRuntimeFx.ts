import { Effect } from "effect";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import type { StateSchema } from "~/v1/state/schema/StateSchema";
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
	} satisfies StateSchema.Type;
});
