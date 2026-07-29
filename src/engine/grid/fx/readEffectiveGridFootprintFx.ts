import { Effect } from "effect";
import { match } from "ts-pattern";

import type { GridSizeSchema } from "~/engine/grid/schema/GridSizeSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace readEffectiveGridFootprintFx {
	export interface Props {
		authored: GridSizeSchema.Type;
		location: GridLocationSchema.Type;
	}
}

/**
 * Reads the effective footprint for one grid surface.
 *
 * Canonical item footprints apply only on Board. Inventory and Toolbar remain
 * one-slot storage surfaces regardless of authored Board dimensions.
 */
export const readEffectiveGridFootprintFx = Effect.fn("readEffectiveGridFootprintFx")(function* ({
	authored,
	location,
}: readEffectiveGridFootprintFx.Props) {
	return match(location.scope)
		.with(LocationScopeEnumSchema.enum.Board, () => {
			return authored;
		})
		.with(LocationScopeEnumSchema.enum.Inventory, LocationScopeEnumSchema.enum.Toolbar, () => {
			return {
				width: 1,
				height: 1,
			} satisfies GridSizeSchema.Type;
		})
		.exhaustive();
});
