import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { StateSchema } from "~/engine/state/schema/StateSchema";

const fromRuntimeItemFn = ({ item }: { readonly item: RuntimeItemSchema.Type }) => ({
	id: item.id,
	itemId: item.item.id,
	location: item.location,
	quantity: item.quantity,
	remainingCharges: item.remainingCharges,
	remainingDurationMs: item.remainingDurationMs,
});
export namespace fromRuntimeFn {
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
export const fromRuntimeFn = ({ runtime }: fromRuntimeFn.Props) => {
	const items = runtime.items.map((item) =>
		fromRuntimeItemFn({
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
		jobQueue: runtime.jobQueue,
		...(Object.keys(runtime.defaultLineByOwnerItemId).length === 0
			? {}
			: {
					defaultLineByOwnerItemId: {
						...runtime.defaultLineByOwnerItemId,
					},
				}),
	} satisfies StateSchema.Type;
};
