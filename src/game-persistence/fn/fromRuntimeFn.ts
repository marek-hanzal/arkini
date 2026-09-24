import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";

const fromRuntimeItemFn = ({ item }: { readonly item: RuntimeItemSchema.Type }) => ({
	id: item.id,
	itemUid: item.item.uid,
	location: item.location,
	...(item.inventory === undefined
		? {}
		: {
				inventory: item.inventory,
			}),
	...(item.mergeSequence === undefined
		? {}
		: {
				mergeSequence: item.mergeSequence,
			}),
	...(item.schedule === undefined
		? {}
		: {
				schedule: {
					...item.schedule,
				},
			}),
	...(item.remainingUnits === undefined
		? {}
		: {
				remainingUnits: item.remainingUnits,
			}),
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
		...(runtime.previousSpace === undefined
			? {}
			: {
					previousSpace: runtime.previousSpace,
				}),
		templateUidBySpace: runtime.templateUidBySpace,
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
