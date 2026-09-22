import type { PositionSchema } from "~/item-location/schema/PositionSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";

interface OrderGridLocationsProps {
	readonly locations: ReadonlyArray<BoardLocationSchema.Type>;
	readonly origin: PositionSchema.Type;
}

/** Orders concrete locations by Manhattan distance and deterministic scan order. */
export const orderGridLocationsFn = ({ locations, origin }: OrderGridLocationsProps) => {
	return [
		...locations,
	].sort((left, right) => {
		const scanOrder = left.position.y - right.position.y || left.position.x - right.position.x;
		const leftDistance =
			Math.abs(left.position.x - origin.x) + Math.abs(left.position.y - origin.y);
		const rightDistance =
			Math.abs(right.position.x - origin.x) + Math.abs(right.position.y - origin.y);

		return leftDistance - rightDistance || scanOrder;
	});
};
