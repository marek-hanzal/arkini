import { Effect } from "effect";
import { match } from "ts-pattern";

import type { QuerySchema } from "~/engine/query/schema/QuerySchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { BoardQueryOriginUnavailableError } from "~/engine/query/error/BoardQueryOriginUnavailableError";
import { QueryScopeEnumSchema } from "~/engine/query/schema/QueryScopeEnumSchema";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";

import { queryAnyFx } from "./queryAnyFx";
import { queryBoardFx } from "./queryBoardFx";
import { queryInventoryFx } from "./queryInventoryFx";
import { queryToolbarFx } from "./queryToolbarFx";
import { queryUniverseFx } from "./queryUniverseFx";

export namespace queryFx {
	export interface Props {
		origin: GridLocationSchema.Type;
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
					scope: QueryScopeEnumSchema.enum.Board,
				},
			},
			({ origin, query }) => {
				if (origin.scope !== LocationScopeEnumSchema.enum.Board) {
					return Effect.fail(
						new BoardQueryOriginUnavailableError({
							origin,
						}),
					);
				}
				return queryBoardFx({
					origin,
					query,
				});
			},
		)
		.with(
			{
				query: {
					scope: QueryScopeEnumSchema.enum.Inventory,
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
					scope: QueryScopeEnumSchema.enum.Toolbar,
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
					scope: QueryScopeEnumSchema.enum.Any,
				},
			},
			({ origin, query }) => {
				return Effect.gen(function* () {
					const space =
						origin.scope === LocationScopeEnumSchema.enum.Board
							? origin.space
							: (yield* readRuntimeFx()).currentSpace;
					return yield* queryAnyFx({
						query,
						space,
					});
				});
			},
		)
		.with(
			{
				query: {
					scope: QueryScopeEnumSchema.enum.Universe,
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
