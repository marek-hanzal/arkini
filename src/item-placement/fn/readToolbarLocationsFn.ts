import type { ToolbarSizeSchema } from "~/item-location/schema/ToolbarSizeSchema";
import type { ToolbarLocationSchema } from "~/item-location/schema/ToolbarLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

interface ReadToolbarLocationsProps {
	readonly size: ToolbarSizeSchema.Type;
}

/** Enumerates every passive toolbar slot from left to right. */
export const readToolbarLocationsFn = ({ size }: ReadToolbarLocationsProps) => {
	const locations: ToolbarLocationSchema.Type[] = [];
	for (let x = 0; x < size; x += 1) {
		locations.push({
			scope: LocationScopeEnumSchema.enum.Toolbar,
			position: {
				x,
				y: 0,
			},
		});
	}
	return locations;
};
