import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

/** Compares two concrete board/inventory locations without relying on object identity. */
export const isSameGridLocation = (
	left: GridLocationSchema.Type,
	right: GridLocationSchema.Type,
) => {
	if (left.scope !== right.scope) return false;
	if (left.position.x !== right.position.x || left.position.y !== right.position.y) {
		return false;
	}
	return left.scope !== "board" || right.scope !== "board" || left.space === right.space;
};
