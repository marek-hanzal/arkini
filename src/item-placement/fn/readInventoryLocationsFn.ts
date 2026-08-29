import type { SizeSchema } from "~/item-location/schema/SizeSchema";
import type { InventoryLocationSchema } from "~/item-location/schema/InventoryLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

interface ReadInventoryLocationsProps {
	readonly size: SizeSchema.Type;
}

/** Enumerates every universe-wide inventory slot in row-major order. */
export const readInventoryLocationsFn = ({ size }: ReadInventoryLocationsProps) => {
	const locations: InventoryLocationSchema.Type[] = [];

	for (let y = 0; y < size.height; y += 1) {
		for (let x = 0; x < size.width; x += 1) {
			locations.push({
				scope: LocationScopeEnumSchema.enum.Inventory,
				position: {
					x,
					y,
				},
			});
		}
	}

	return locations;
};
