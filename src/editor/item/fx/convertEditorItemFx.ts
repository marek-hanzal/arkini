import { Effect } from "effect";

import { createEditorItemDraftFn } from "~/editor/fn/createEditorItemDraftFn";
import { readAuthoredItemLinesFx } from "~/engine/line/read/readAuthoredItemLinesFx";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { TypeSchema } from "~/engine/item/schema/TypeSchema";

/** Converts one canonical item while retaining every field understood by the target type. */
export const convertEditorItemFx = Effect.fn("convertEditorItemFx")(
	(item: ItemSchema.Type, targetType: TypeSchema.Type) =>
		Effect.gen(function* () {
			if (item.type === targetType) return item;
			const fallback = createEditorItemDraftFn({
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
			const lines = yield* readAuthoredItemLinesFx(item);
			const fallbackLines = yield* readAuthoredItemLinesFx(fallback);
			const fallbackLine = fallbackLines[0];
			const fallbackQueueSize =
				fallback.type === "deposit" || fallback.type === "producer"
					? fallback.maxQueueSize
					: 1;
			const candidate = (() => {
				switch (targetType) {
					case "simple":
						return {
							...common,
							type: targetType,
						};
					case "space":
						return {
							...common,
							type: targetType,
							space: item.type === "space" ? item.space : 0,
							enable: item.type === "space" ? item.enable : true,
							input: item.type === "space" ? item.input : [],
							rules: item.type === "space" ? item.rules : [],
						};
					case "inventory":
						return {
							...common,
							type: targetType,
							scope: fallback.scope,
							maxCount: fallback.maxCount,
							maxStackSize: fallback.maxStackSize,
						};
					case "temporary":
						return {
							...common,
							type: targetType,
							scope: fallback.scope,
							maxStackSize: fallback.maxStackSize,
							durationMs:
								item.type === "temporary"
									? item.durationMs
									: fallback.type === "temporary"
										? fallback.durationMs
										: 500,
							...(item.type === "temporary" && item.output !== undefined
								? {
										output: item.output,
									}
								: {}),
						};
					case "deposit":
						return {
							...common,
							type: targetType,
							maxQueueSize:
								item.type === "deposit" || item.type === "producer"
									? item.maxQueueSize
									: fallbackQueueSize,
							...(lines.length === 0
								? {}
								: {
										lines,
									}),
						};
					case "producer":
						return {
							...common,
							type: targetType,
							maxQueueSize:
								item.type === "deposit" || item.type === "producer"
									? item.maxQueueSize
									: fallbackQueueSize,
							lines: lines.length === 0 ? fallbackLines : lines,
						};
					case "blueprint":
					case "craft":
					case "stash":
						return {
							...common,
							type: targetType,
							line: lines[0] ?? fallbackLine,
						};
				}
			})();
			return ItemSchema.parse(candidate);
		}),
);
