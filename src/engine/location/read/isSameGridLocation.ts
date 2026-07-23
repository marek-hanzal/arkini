import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

/** Compares two concrete board/inventory/toolbar locations without relying on object identity. */
export const isSameGridLocation = (
	left: GridLocationSchema.Type,
	right: GridLocationSchema.Type,
) => {
	if (left.scope !== right.scope) return false;
	if (left.position.x !== right.position.x || left.position.y !== right.position.y) {
		return false;
	}
	return (
		left.scope !== LocationScopeEnumSchema.enum.Board ||
		right.scope !== LocationScopeEnumSchema.enum.Board ||
		left.space === right.space
	);
};
