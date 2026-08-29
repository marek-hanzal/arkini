import { Array, Effect } from "effect";
import { match } from "ts-pattern";

import { DistanceSchema } from "~/engine/distance/schema/DistanceSchema";
import type { PositionSchema } from "~/engine/grid/schema/PositionSchema";
import type { QuerySchema } from "~/engine/query/schema/QuerySchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { BoardQueryOriginUnavailableError } from "~/engine/query/error/BoardQueryOriginUnavailableError";
import { ScopeSchema } from "~/engine/query/schema/ScopeSchema";
import { isBoardRuntimeItemFn } from "~/engine/runtime/read/fn/isBoardRuntimeItemFn";
import { isGridRuntimeItemFn } from "~/engine/runtime/read/fn/isGridRuntimeItemFn";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { selectItemsFn } from "~/engine/selector/fn/selectItemsFn";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";

const queryItemsFn = ({
	items,
	selector,
}: {
	readonly items: ReadonlyArray<RuntimeItemSchema.Type>;
	readonly selector: SelectorSchema.Type;
}) => {
	const selectedItemIds = new Set(
		selectItemsFn({
			items: items.map((item) => item.item),
			selector,
		}).map((item) => item.id),
	);
	return items.filter((item) => selectedItemIds.has(item.item.id));
};

const matchesDistanceFn = ({
	distance,
	item,
	origin,
}: {
	readonly distance: DistanceSchema.Type;
	readonly item: PositionSchema.Type;
	readonly origin: PositionSchema.Type;
}) => {
	const value = Math.max(Math.abs(item.x - origin.x), Math.abs(item.y - origin.y));

	return match(distance)
		.with(DistanceSchema.enum.Self, () => value === 0)
		.with(DistanceSchema.enum.Close, () => value === 1)
		.with(DistanceSchema.enum.Near, () => value === 2)
		.with(DistanceSchema.enum.Far, () => value > 0)
		.exhaustive();
};

export namespace queryFx {
	export interface Props {
		origin: GridLocationSchema.Type;
		query: QuerySchema.Type;
	}
}

/** Selects runtime items from one pinned snapshot according to authored query reach. */
export const queryFx = Effect.fn("queryFx")(function* ({ origin, query }: queryFx.Props) {
	if (query.scope === ScopeSchema.enum.Board) {
		if (origin.scope !== LocationScopeEnumSchema.enum.Board) {
			return yield* Effect.fail(
				new BoardQueryOriginUnavailableError({
					origin,
				}),
			);
		}

		const runtime = yield* readRuntimeFx();
		const selected = Array.getSomes(
			queryItemsFn({
				items: Array.getSomes(runtime.items.map(isBoardRuntimeItemFn)).filter(
					(item) => item.location.space === origin.space,
				),
				selector: query.selector,
			}).map(isBoardRuntimeItemFn),
		);

		return selected.filter((item) =>
			matchesDistanceFn({
				distance: query.distance,
				item: item.location.position,
				origin: origin.position,
			}),
		);
	}

	const runtime = yield* readRuntimeFx();
	const gridItems = Array.getSomes(runtime.items.map(isGridRuntimeItemFn));
	const items = match(query.scope)
		.with(ScopeSchema.enum.Inventory, () =>
			gridItems.filter(
				(item) => item.location.scope === LocationScopeEnumSchema.enum.Inventory,
			),
		)
		.with(ScopeSchema.enum.Toolbar, () =>
			gridItems.filter(
				(item) => item.location.scope === LocationScopeEnumSchema.enum.Toolbar,
			),
		)
		.with(ScopeSchema.enum.Any, () => {
			const space =
				origin.scope === LocationScopeEnumSchema.enum.Board
					? origin.space
					: runtime.currentSpace;
			return gridItems.filter(
				(item) =>
					item.location.scope !== LocationScopeEnumSchema.enum.Board ||
					item.location.space === space,
			);
		})
		.with(ScopeSchema.enum.Universe, () => gridItems)
		.exhaustive();

	return queryItemsFn({
		items,
		selector: query.selector,
	});
});
