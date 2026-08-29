import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { StateSchema } from "~/game-persistence/StateSchema";

const fromRuntimeItemFn = ({ item }: { readonly item: RuntimeItemSchema.Type }) => ({
	id: item.id,
	itemId: item.item.id,
	location: item.location,
	quantity: item.quantity,
	remainingCharges: item.remainingCharges,
	remainingDurationMs: item.remainingDurationMs,
});
interface Props {
	runtime: RuntimeSchema.Type;
}

/**
 * Projects one hydrated runtime into serializable gameplay state.
 *
 * Runtime-only canonical objects and optimistic revisions are intentionally
 * omitted; hydration will resolve item definitions and mint new revisions for
 * the next session.
 */
export const fromRuntimeFn = ({ runtime }: Props) => {
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
