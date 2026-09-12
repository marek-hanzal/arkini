import { createDraftFn } from "~/item-authoring/fn/createDraftFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";

/** Converts one canonical item while retaining every field understood by the target type. */
export const convertFn = (item: ItemSchema.Type, targetType: TypeSchema.Type): ItemSchema.Type => {
	if (item.type === targetType) return item;
	const fallback = createDraftFn({
		resourceId: item.asset.default[0],
		type: targetType,
		uid: item.uid,
	});
	const common = {
		uid: item.uid,
		id: item.id,
		title: item.title,
		draft: item.draft,
		...(item.description === undefined
			? {}
			: {
					description: item.description,
				}),
		asset: item.asset,
		scope: item.scope,
		...(item.maxCount === undefined
			? {}
			: {
					maxCount: item.maxCount,
				}),
		maxStackSize: item.maxStackSize,
		...(item.units === undefined
			? {}
			: {
					units: item.units,
				}),
		...(item.merge === undefined
			? {}
			: {
					merge: item.merge,
				}),
	};
	const candidate: ItemSchema.Type = (() => {
		switch (fallback.type) {
			case "inventory":
				return {
					...common,
					type: fallback.type,
					scope: fallback.scope,
					maxCount: fallback.maxCount,
					maxStackSize: fallback.maxStackSize,
				};
			case "common":
				return {
					...common,
					type: fallback.type,
					maxQueueSize: fallback.maxQueueSize,
					lines: [],
				};
		}
	})();
	return candidate;
};
