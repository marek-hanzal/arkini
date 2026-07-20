import { Effect } from "effect";
import { match } from "ts-pattern";

import type { QuerySchema } from "~/engine/query/schema/QuerySchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { queryAnyFx } from "./queryAnyFx";
import { queryBoardFx } from "./queryBoardFx";
import { queryInventoryFx } from "./queryInventoryFx";
import { queryToolbarFx } from "./queryToolbarFx";
import { queryUniverseFx } from "./queryUniverseFx";

export namespace queryFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
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
					scope: "toolbar",
				},
			},
			({ query }) => {
				return queryToolbarFx({
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
			({ origin, query }) => {
				return queryAnyFx({
					origin,
					query,
				});
			},
		)
		.with(
			{
				query: {
					scope: "universe",
				},
			},
			({ query }) => {
				return queryUniverseFx({
					query,
				});
			},
		)
		.exhaustive();
});
