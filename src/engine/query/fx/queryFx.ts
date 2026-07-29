import { Effect } from "effect";
import { match } from "ts-pattern";

import type { QuerySchema } from "~/engine/query/schema/QuerySchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { QueryScopeEnumSchema } from "~/engine/query/schema/QueryScopeEnumSchema";
import type { BoardRectangleSchema } from "~/engine/grid/schema/BoardRectangleSchema";

import { queryAnyFx } from "./queryAnyFx";
import { queryBoardFx } from "./queryBoardFx";
import { queryInventoryFx } from "./queryInventoryFx";
import { queryToolbarFx } from "./queryToolbarFx";
import { queryUniverseFx } from "./queryUniverseFx";

export namespace queryFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		originRectangle?: BoardRectangleSchema.Type;
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
			({ origin, originRectangle, query }) => {
				return queryBoardFx({
					origin,
					originRectangle,
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
				return queryAnyFx({
					origin,
					query,
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
