import { Effect } from "effect";
import { match, P } from "ts-pattern";

import { isLinePureFx } from "~/engine/line/fx/purity/isLinePureFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

export namespace isItemPureFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Returns whether one live item owns no identity-bound runtime state. */
export const isItemPureFx = Effect.fn("isItemPureFx")(function* ({
	item,
	runtime,
}: isItemPureFx.Props) {
	const lines = match(item.item)
		.with(
			{
				type: ItemEnumSchema.enum.Producer,
			},
			({ lines }) => lines,
		)
		.with(
			{
				type: P.union(ItemEnumSchema.enum.Blueprint, ItemEnumSchema.enum.Craft, ItemEnumSchema.enum.Stash),
			},
			({ line }) => [
				line,
			],
		)
		.otherwise(() => []);

	if (item.remainingCharges !== undefined) {
		return false;
	}
	if (item.remainingDurationMs !== undefined) {
		return false;
	}
	if (runtime.defaultLineByOwnerItemId?.[item.id] !== undefined) {
		return false;
	}

	const linePurity = yield* Effect.forEach(lines, (line) => {
		return isLinePureFx({
			ownerItemId: item.id,
			lineId: line.id,
			runtime,
		});
	});

	// Future item-owned runtime state must extend this predicate here.
	return linePurity.every(Boolean);
});
