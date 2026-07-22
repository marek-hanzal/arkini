import { Effect } from "effect";
import { match } from "ts-pattern";

import { WhenEnumSchema } from "~/engine/when/schema/WhenEnumSchema";
import { queryFx } from "~/engine/query/fx/queryFx";
import { queryQuantityFx } from "~/engine/query/fx/queryQuantityFx";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

import { whenCountFx } from "./whenCountFx";
import { whenExistsFx } from "./whenExistsFx";
import { whenRangeFx } from "./whenRangeFx";

export namespace whenFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
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
	const quantity = yield* queryQuantityFx({
		items,
	});

	return yield* match(when)
		.with(
			{
				type: WhenEnumSchema.enum.Exists,
			},
			() => {
				return whenExistsFx({
					quantity,
				});
			},
		)
		.with(
			{
				type: WhenEnumSchema.enum.Count,
			},
			({ count }) => {
				return whenCountFx({
					count,
					quantity,
				});
			},
		)
		.with(
			{
				type: WhenEnumSchema.enum.Range,
			},
			({ max, min }) => {
				return whenRangeFx({
					max,
					min,
					quantity,
				});
			},
		)
		.exhaustive();
});
