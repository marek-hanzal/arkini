import { Effect } from "effect";
import { match } from "ts-pattern";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace areGridLocationsWithinBoundsFx {
	export interface Props {
		readonly locations: ReadonlyArray<GridLocationSchema.Type>;
		readonly scope: GridLocationSchema.Type["scope"];
	}
}

/** Checks grid cells against the configured bounds of one location scope. */
export const areGridLocationsWithinBoundsFx = Effect.fn("areGridLocationsWithinBoundsFx")(
	function* ({ locations, scope }: areGridLocationsWithinBoundsFx.Props) {
		const config = yield* GameConfigFx;
		const size = match(scope)
			.with(LocationScopeEnumSchema.enum.Board, () => config.meta.board)
			.with(LocationScopeEnumSchema.enum.Inventory, () => config.meta.inventory)
			.with(LocationScopeEnumSchema.enum.Toolbar, () => ({
				width: config.meta.toolbarSize ?? 0,
				height: 1,
			}))
			.exhaustive();

		return locations.every(
			(location) => location.position.x < size.width && location.position.y < size.height,
		);
	},
);
