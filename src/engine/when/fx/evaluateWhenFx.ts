import { Effect } from "effect";
import { match } from "ts-pattern";

import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { queryFx } from "~/engine/query/fx/queryFx";
import { queryQuantityFx } from "~/engine/query/fx/queryQuantityFx";
import { WhenEnumSchema } from "~/engine/when/schema/WhenEnumSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

import { whenCountFx } from "./whenCountFx";
import { whenExistsFx } from "./whenExistsFx";
import { whenRangeFx } from "./whenRangeFx";

export namespace evaluateWhenFx {
	export interface Props {
		readonly origin: BoardLocationSchema.Type;
		readonly when: WhenSchema.Type;
	}
}

/** Evaluates one condition from the exact runtime query result. */
export const evaluateWhenFx = Effect.fn("evaluateWhenFx")(function* ({
	origin,
	when,
}: evaluateWhenFx.Props) {
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
			() =>
				whenExistsFx({
					quantity,
				}),
		)
		.with(
			{
				type: WhenEnumSchema.enum.Count,
			},
			({ count }) =>
				whenCountFx({
					count,
					quantity,
				}),
		)
		.with(
			{
				type: WhenEnumSchema.enum.Range,
			},
			({ max, min }) =>
				whenRangeFx({
					max,
					min,
					quantity,
				}),
		)
		.exhaustive();
});
