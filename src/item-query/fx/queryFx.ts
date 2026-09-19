import { Array, Effect } from "effect";
import { matchesQueryLocationFn } from "~/item-query/fn/matchesQueryLocationFn";

import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { BoardQueryOriginUnavailableError } from "~/item-query/error/BoardQueryOriginUnavailableError";
import { ScopeSchema } from "~/item-query/schema/ScopeSchema";
import { narrowGridRuntimeItemFn } from "~/game-runtime/fn/narrowGridRuntimeItemFn";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import { selectItemsFn } from "~/item-definition/fn/selectItemsFn";
import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";

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

interface Props {
	readonly origin: GridLocationSchema.Type;
	readonly query: QuerySchema.Type;
}

/** Selects runtime items from one pinned snapshot according to authored query reach. */
export const queryFx = Effect.fn("queryFx")(function* ({ origin, query }: Props) {
	if (query.scope === ScopeSchema.enum.Board) {
		if (origin.scope !== LocationScopeEnumSchema.enum.Board) {
			return yield* Effect.fail(
				new BoardQueryOriginUnavailableError({
					origin,
				}),
			);
		}
	}

	const runtime = yield* readRuntimeFx();
	const gridItems = Array.getSomes(runtime.items.map(narrowGridRuntimeItemFn));
	const items = gridItems.filter((item) =>
		matchesQueryLocationFn({
			location: item.location,
			origin,
			query,
			currentSpace: runtime.currentSpace,
		}),
	);

	return queryItemsFn({
		items,
		selector: query.selector,
	});
});
