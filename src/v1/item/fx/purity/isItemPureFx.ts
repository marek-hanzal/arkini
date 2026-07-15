import { Effect } from "effect";
import { match, P } from "ts-pattern";

import { isLinePureFx } from "~/v1/line/fx/purity/isLinePureFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

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
				type: "producer",
			},
			({ lines }) => lines,
		)
		.with(
			{
				type: P.union("blueprint", "craft", "stash"),
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

	const linePurity = yield* Effect.forEach(lines, (line) => {
		return isLinePureFx({
			ownerItemId: item.id,
			lineId: line.id,
			runtime,
		});
	});

	// Future item-owned state such as memory must extend this predicate here.
	return linePurity.every(Boolean);
});
