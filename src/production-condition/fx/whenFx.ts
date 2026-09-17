import { Effect } from "effect";
import { match } from "ts-pattern";

import { TypeSchema } from "~/production-condition/schema/TypeSchema";
import { queryFx } from "~/item-query/fx/queryFx";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";
import { resolveItemFx } from "~/item-resolution/fx/resolveItemFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";

export namespace whenFx {
	export interface Props {
		origin: GridLocationSchema.Type;
		when: WhenSchema.Type;
	}
}

/**
 * Evaluates one condition against the caller's pinned runtime snapshot.
 */
export const whenFx = Effect.fn("whenFx")(function* ({ origin, when }: whenFx.Props) {
	if (when.type === TypeSchema.enum.Limit) {
		const item = yield* resolveItemFx({
			itemId: when.itemId,
		});
		if (item.maxCount === undefined) return false;
		const runtime = yield* readRuntimeFx();
		// Material and delivery remain live quantities. Future job output does not:
		// counting it here would let a completion veto its own reserved final slot.
		const quantity = runtime.items.reduce(
			(total, candidate) =>
				candidate.item.id === item.id ? total + candidate.quantity : total,
			0,
		);
		return quantity >= item.maxCount;
	}
	const items = yield* queryFx({
		origin,
		query: when.query,
	}).pipe(Effect.catchTag("BoardQueryOriginUnavailableError", () => Effect.succeed(undefined)));
	// A missing physical Board origin makes the condition unavailable, not an
	// empty query that could accidentally satisfy count: 0 or a zero-based range.
	if (items === undefined) return false;
	const quantity = items.reduce((total, item) => {
		return total + item.quantity;
	}, 0);

	return match(when)
		.with(
			{
				type: TypeSchema.enum.Exists,
			},
			() => {
				return quantity > 0;
			},
		)
		.with(
			{
				type: TypeSchema.enum.Count,
			},
			({ count }) => {
				return quantity === count;
			},
		)
		.with(
			{
				type: TypeSchema.enum.Range,
			},
			({ max, min }) => {
				return quantity >= min && quantity <= max;
			},
		)
		.exhaustive();
});
