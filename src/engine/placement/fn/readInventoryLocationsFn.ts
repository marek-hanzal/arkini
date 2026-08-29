import type { SizeSchema } from "~/engine/grid/schema/SizeSchema";
import type { InventoryLocationSchema } from "~/engine/location/schema/InventoryLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace readInventoryLocationsFn {
	export interface Props {
		size: SizeSchema.Type;
	}
}

/** Enumerates every universe-wide inventory slot in row-major order. */
export const readInventoryLocationsFn = ({ size }: readInventoryLocationsFn.Props) => {
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
