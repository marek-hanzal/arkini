import { createDraftFn } from "~/item-authoring/fn/createDraftFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { readAuthoredItemLinesFn } from "~/production-line/fn/readAuthoredItemLinesFn";

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
	const lines = readAuthoredItemLinesFn(item);
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
			case "temporary":
				return {
					...common,
					type: fallback.type,
					scope: fallback.scope,
					maxStackSize: fallback.maxStackSize,
					durationMs: item.type === "temporary" ? item.durationMs : fallback.durationMs,
					...(item.type === "temporary" && item.output !== undefined
						? {
								output: item.output,
							}
						: {}),
				};
			case "common":
				return {
					...common,
					type: fallback.type,
					maxQueueSize:
						item.type === "common" || item.type === "clock"
							? item.maxQueueSize
							: fallback.maxQueueSize,
					lines: [
						...lines,
					],
				};
			case "clock":
				return {
					...common,
					type: fallback.type,
					scope: fallback.scope,
					maxStackSize: fallback.maxStackSize,
					intervalMs: fallback.intervalMs,
					enable: fallback.enable,
					rules: fallback.rules,
					control: fallback.control,
					...(item.type === "temporary"
						? {
								durationMs: item.durationMs,
								onExpire: item.output,
							}
						: {}),
					maxQueueSize:
						"maxQueueSize" in item ? item.maxQueueSize : fallback.maxQueueSize,
					lines:
						lines.length === 0
							? fallback.lines
							: [
									lines[0],
									...lines.slice(1),
								],
				};
		}
	})();
	return candidate;
};
