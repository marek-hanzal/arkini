import { Effect } from "effect";
import { match } from "ts-pattern";

import { queryFx } from "~/v1/query/fx/queryFx";
import { queryQuantityFx } from "~/v1/query/fx/queryQuantityFx";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import type { WhenSchema } from "~/v1/when/schema/WhenSchema";
import { whenCountFx } from "./whenCountFx";
import { whenExistsFx } from "./whenExistsFx";
import { whenRangeFx } from "./whenRangeFx";

export namespace whenFx {
	export interface Props {
		origin: PositionSchema.Type;
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
				type: "exists",
			},
			() => {
				return whenExistsFx({
					quantity,
				});
			},
		)
		.with(
			{
				type: "count",
			},
			(when) => {
				return whenCountFx({
					quantity,
					when,
				});
			},
		)
		.with(
			{
				type: "range",
			},
			(when) => {
				return whenRangeFx({
					quantity,
					when,
				});
			},
		)
		.exhaustive();
});
