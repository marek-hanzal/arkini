import type { SizeSchema } from "~/item-location/schema/SizeSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

interface ReadBoardLocationsProps {
	readonly size: SizeSchema.Type;
	readonly space: NonNegativeIntegerSchema.Type;
}

/** Enumerates every concrete cell in one board space in row-major order. */
export const readBoardLocationsFn = ({ size, space }: ReadBoardLocationsProps) => {
	const locations: BoardLocationSchema.Type[] = [];

	for (let y = 0; y < size.height; y += 1) {
		for (let x = 0; x < size.width; x += 1) {
			locations.push({
				scope: LocationScopeEnumSchema.enum.Board,
				space,
				position: {
					x,
					y,
				},
			});
		}
	}

	return locations;
};
