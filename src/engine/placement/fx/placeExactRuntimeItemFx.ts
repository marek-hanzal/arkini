import { Effect } from "effect";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { isItemLocationScopeAllowedFx } from "~/engine/location/read/isItemLocationScopeAllowedFx";
import { isSameGridLocationFx } from "~/engine/location/read/isSameGridLocationFx";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { readBoardLocationsFx } from "./readBoardLocationsFx";
import { readEmptyLocationsFx } from "./readEmptyLocationsFx";
import { readInventoryLocationsFx } from "./readInventoryLocationsFx";
import { readRuntimeItemDropLocationFx } from "./readRuntimeItemDropLocationFx";
import { readToolbarLocationsFx } from "./readToolbarLocationsFx";
import type { BoardRectangleSchema } from "~/engine/grid/schema/BoardRectangleSchema";

export namespace placeExactRuntimeItemFx {
	export interface Props {
		item: GridRuntimeItemSchema.Type;
		origin: BoardLocationSchema.Type;
		originRectangle?: BoardRectangleSchema.Type;
		preferredLocations?: ReadonlyArray<GridLocationSchema.Type>;
		runtime: RuntimeSchema.Type;
	}

	export interface Result {
		item: GridRuntimeItemSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Places one detached identity without normalizing its quantity, state, or owned subtree. */
export const placeExactRuntimeItemFx = Effect.fn("placeExactRuntimeItemFx")(function* ({
	item,
	origin,
	originRectangle,
	preferredLocations = [],
	runtime,
}: placeExactRuntimeItemFx.Props) {
	const config = yield* GameConfigFx;
	const board = yield* readBoardLocationsFx({
		size: config.meta.board,
		space: origin.space,
	});
	const inventory = yield* readInventoryLocationsFx({
		size: config.meta.inventory,
	});
	const toolbar = yield* readToolbarLocationsFx({
		size: config.meta.toolbarSize ?? 0,
	});
	const available = yield* readEmptyLocationsFx({
		item: item.item,
		locations: [
			...board,
			...inventory,
			...toolbar,
		],
		runtime,
	});
	let location: GridLocationSchema.Type | undefined;
	for (const preferred of preferredLocations) {
		if (
			!(yield* isItemLocationScopeAllowedFx({
				item: item.item,
				locationScope: preferred.scope,
			}))
		) {
			continue;
		}
		for (const candidate of available) {
			if (
				yield* isSameGridLocationFx({
					left: candidate,
					right: preferred,
				})
			) {
				location = preferred;
				break;
			}
		}
		if (location !== undefined) break;
	}
	location ??= yield* readRuntimeItemDropLocationFx({
		item,
		origin,
		originRectangle,
		runtime,
	});
	const placed = yield* reviseRuntimeItemFx({
		item: {
			...item,
			location,
		},
	});
	return {
		item: placed,
		runtime: {
			...runtime,
			items: [
				...runtime.items,
				placed,
			],
		},
	} satisfies placeExactRuntimeItemFx.Result;
});
