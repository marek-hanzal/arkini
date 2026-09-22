import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";

interface SameGridLocationProps {
	readonly left: BoardLocationSchema.Type;
	readonly right: BoardLocationSchema.Type;
}

/** Compares two concrete board locations by their full identity. */
export const isSameGridLocationFn = ({ left, right }: SameGridLocationProps) =>
	left.space === right.space &&
	left.position.x === right.position.x &&
	left.position.y === right.position.y;
