import { Effect } from "effect";
import { match } from "ts-pattern";

import { TypeSchema } from "~/production-condition/schema/TypeSchema";
import { queryFx } from "~/item-query/fx/queryFx";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";

export namespace whenFx {
	export interface Props {
		origin: GridLocationSchema.Type;
		when: WhenSchema.Type;
	}
}

/**
 * Resolves one runtime query and evaluates its total quantity as a condition.
 */
export const whenFx = Effect.fn("whenFx")(function* ({ origin, when }: whenFx.Props) {
	const items = yield* queryFx({
		origin,
		query: when.query,
	});
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
