import { Effect } from "effect";
import { match, P } from "ts-pattern";

import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { ItemPurityIndex } from "./readItemPurityIndexFx";

const readOwnedLines = (item: RuntimeItemSchema.Type): readonly LineSchema.Type[] =>
	match(item.item)
		.with(
			{
				type: ItemEnumSchema.enum.Producer,
			},
			({ lines }) => lines,
		)
		.with(
			{
				type: ItemEnumSchema.enum.Deposit,
			},
			({ lines }) => lines ?? [],
		)
		.with(
			{
				type: P.union(
					ItemEnumSchema.enum.Blueprint,
					ItemEnumSchema.enum.Craft,
					ItemEnumSchema.enum.Stash,
				),
			},
			({ line }) => [
				line,
			],
		)
		.otherwise(() => []);

/** Reads item purity from one pre-indexed immutable runtime snapshot. */
export const isItemPureWithIndexFx = Effect.fnUntraced(function* ({
	index,
	item,
	runtime,
}: {
	readonly index: ItemPurityIndex;
	readonly item: RuntimeItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	if (
		item.remainingCharges !== undefined ||
		item.remainingDurationMs !== undefined ||
		Object.hasOwn(runtime.defaultLineByOwnerItemId, item.id)
	) {
		return false;
	}
	const inputLineIds = index.inputLineIdsByOwnerId.get(item.id);
	const jobLineIds = index.jobLineIdsByOwnerId.get(item.id);
	const queueLineIds = index.queueLineIdsByOwnerId.get(item.id);
	return readOwnedLines(item).every(
		(line) =>
			inputLineIds?.has(line.id) !== true &&
			jobLineIds?.has(line.id) !== true &&
			queueLineIds?.has(line.id) !== true,
	);
});
