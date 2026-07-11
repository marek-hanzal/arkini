import { Effect } from "effect";
import { match } from "ts-pattern";

import { queryFx } from "~/v1/query/fx/queryFx";
import { queryQuantityFx } from "~/v1/query/fx/queryQuantityFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { WhenSchema } from "~/v1/when/schema/WhenSchema";
import { whenCountFx } from "./whenCountFx";
import { whenExistsFx } from "./whenExistsFx";
import { whenRangeFx } from "./whenRangeFx";

export namespace whenFx {
	export interface Props {
		origin: RuntimeItemSchema.Type;
		when: WhenSchema.Type;
	}
}

/**
 * Resolves one runtime query and evaluates its total quantity as a condition.
 */
export const whenFx = Effect.fn("whenFx")(function* ({ origin, when }: whenFx.Props) {
	const items = yield* match(when.query)
		.with(
			{
				scope: "board",
			},
			(query) => {
				return queryFx({
					origin,
					query,
				});
			},
		)
		.with(
			{
				scope: "inventory",
			},
			(query) => {
				return queryFx({
					query,
				});
			},
		)
		.with(
			{
				scope: "any",
			},
			(query) => {
				return queryFx({
					query,
				});
			},
		)
		.exhaustive();
	const quantity = yield* queryQuantityFx({
		items,
	});

	return yield* match(when)
		.with(
			{
				type: "exists",
			},
			(when) => {
				return whenExistsFx({
					...when,
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
					...when,
					quantity,
				});
			},
		)
		.with(
			{
				type: "range",
			},
			(when) => {
				return whenRangeFx({
					...when,
					quantity,
				});
			},
		)
		.exhaustive();
});
