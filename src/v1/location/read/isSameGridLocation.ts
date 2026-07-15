import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";

/** Compares two concrete grid cells, including board-space identity. */
export const isSameGridLocation = (
	left: GridLocationSchema.Type,
	right: GridLocationSchema.Type,
) => {
	if (left.scope !== right.scope) {
		return false;
	}
	if (left.scope === "board" && right.scope === "board" && left.space !== right.space) {
		return false;
	}

	return left.position.x === right.position.x && left.position.y === right.position.y;
};
