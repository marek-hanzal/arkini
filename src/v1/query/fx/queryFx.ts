import { Effect } from "effect";
import { match } from "ts-pattern";

import type { QuerySchema } from "~/v1/query/schema/QuerySchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import { queryAnyFx } from "./queryAnyFx";
import { queryBoardFx } from "./queryBoardFx";
import { queryInventoryFx } from "./queryInventoryFx";

export namespace queryFx {
	export interface Props {
		origin: RuntimeItemSchema.Type;
		query: QuerySchema.Type;
	}
}

/**
 * Dispatches a runtime item query to its scope-specific implementation.
 */
export const queryFx = Effect.fn("queryFx")(function* (props: queryFx.Props) {
	return yield* match(props)
		.with(
			{
				query: {
					scope: "board",
				},
			},
			({ origin, query }) => {
				return queryBoardFx({
					origin,
					query,
				});
			},
		)
		.with(
			{
				query: {
					scope: "inventory",
				},
			},
			({ query }) => {
				return queryInventoryFx({
					query,
				});
			},
		)
		.with(
			{
				query: {
					scope: "any",
				},
			},
			({ query }) => {
				return queryAnyFx({
					query,
				});
			},
		)
		.exhaustive();
});
