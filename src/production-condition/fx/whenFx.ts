import { Effect } from "effect";
import { match } from "ts-pattern";

import { TypeSchema } from "~/production-condition/schema/TypeSchema";
import { queryFx } from "~/item-query/fx/queryFx";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";

export namespace whenFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		when: WhenSchema.Type;
	}
}

/**
 * Evaluates one condition against the caller's pinned runtime snapshot.
 */
export const whenFx = Effect.fn("whenFx")(function* ({ origin, when }: whenFx.Props) {
	const items = yield* queryFx({
		origin,
		query: when.query,
	});
	const quantity = items.length;

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
