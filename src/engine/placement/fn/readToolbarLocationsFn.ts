import type { ToolbarSizeSchema } from "~/engine/meta/schema/ToolbarSizeSchema";
import type { ToolbarLocationSchema } from "~/engine/location/schema/ToolbarLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace readToolbarLocationsFn {
	export interface Props {
		size: ToolbarSizeSchema.Type;
	}
}

/** Enumerates every passive toolbar slot from left to right. */
export const readToolbarLocationsFn = ({ size }: readToolbarLocationsFn.Props) => {
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
