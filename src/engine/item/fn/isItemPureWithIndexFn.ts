import { match, P } from "ts-pattern";

import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { ItemPurityIndex } from "./readItemPurityIndexFn";

const readOwnedLines = (item: RuntimeItemSchema.Type): readonly LineSchema.Type[] =>
	match(item.item)
		.with(
			{
				type: TypeSchema.enum.Producer,
			},
			({ lines }) => lines,
		)
		.with(
			{
				type: TypeSchema.enum.Deposit,
			},
			({ lines }) => lines ?? [],
		)
		.with(
			{
				type: P.union(
					TypeSchema.enum.Blueprint,
					TypeSchema.enum.Craft,
					TypeSchema.enum.Stash,
				),
			},
			({ line }) => [
				line,
			],
		)
		.otherwise(() => []);

/** Reads item purity from one pre-indexed immutable runtime snapshot. */
export const isItemPureWithIndexFn = ({
	index,
	item,
	runtime,
}: {
	readonly index: ItemPurityIndex;
	readonly item: RuntimeItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) => {
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
};
