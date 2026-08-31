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
		description: item.description,
		asset: item.asset,
		scope: item.scope,
		...(item.maxCount === undefined
			? {}
			: {
					maxCount: item.maxCount,
				}),
		maxStackSize: item.maxStackSize,
		...(item.charges === undefined
			? {}
			: {
					charges: item.charges,
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
			case "simple":
				return {
					...common,
					type: fallback.type,
				};
			case "space":
				return {
					...common,
					type: fallback.type,
					space: item.type === "space" ? item.space : 0,
					enable: item.type === "space" ? item.enable : true,
					input: item.type === "space" ? item.input : [],
					rules: item.type === "space" ? item.rules : [],
				};
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
			case "deposit":
				return {
					...common,
					type: fallback.type,
					maxQueueSize:
						item.type === "deposit" || item.type === "producer"
							? item.maxQueueSize
							: fallback.maxQueueSize,
					...(lines.length === 0
						? {}
						: {
								lines: [
									lines[0],
									...lines.slice(1),
								],
							}),
				};
			case "producer":
				return {
					...common,
					type: fallback.type,
					maxQueueSize:
						item.type === "deposit" || item.type === "producer"
							? item.maxQueueSize
							: fallback.maxQueueSize,
					lines:
						lines.length === 0
							? fallback.lines
							: [
									lines[0],
									...lines.slice(1),
								],
				};
			case "blueprint":
			case "craft":
			case "stash":
				return {
					...common,
					type: fallback.type,
					line: lines[0] ?? fallback.line,
				};
		}
	})();
	return candidate;
};
