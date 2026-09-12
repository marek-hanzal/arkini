import { readAuthoredItemLinesFn } from "~/production-line/fn/readAuthoredItemLinesFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { ItemPurityIndex } from "./readItemPurityIndexFn";

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
		item.schedule !== undefined ||
		item.remainingUnits !== undefined ||
		item.remainingDurationMs !== undefined ||
		Object.hasOwn(runtime.defaultLineByOwnerItemId, item.id)
	) {
		return false;
	}
	const inputLineIds = index.inputLineIdsByOwnerId.get(item.id);
	const jobLineIds = index.jobLineIdsByOwnerId.get(item.id);
	const queueLineIds = index.queueLineIdsByOwnerId.get(item.id);
	return readAuthoredItemLinesFn(item.item).every(
		(line) =>
			inputLineIds?.has(line.id) !== true &&
			jobLineIds?.has(line.id) !== true &&
			queueLineIds?.has(line.id) !== true,
	);
};
