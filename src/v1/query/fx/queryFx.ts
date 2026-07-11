import { Effect } from "effect";
import { match } from "ts-pattern";

import type { QueryAnySchema } from "~/v1/query/schema/QueryAnySchema";
import type { QueryBoardSchema } from "~/v1/query/schema/QueryBoardSchema";
import type { QueryInventorySchema } from "~/v1/query/schema/QueryInventorySchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import { queryAnyFx } from "./queryAnyFx";
import { queryBoardFx } from "./queryBoardFx";
import { queryInventoryFx } from "./queryInventoryFx";

export namespace queryFx {
	export type Props =
		| {
				origin: RuntimeItemSchema.Type;
				query: QueryBoardSchema.Type;
		  }
		| {
				query: QueryInventorySchema.Type;
		  }
		| {
				query: QueryAnySchema.Type;
		  };
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
