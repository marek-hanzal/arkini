import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

interface SameGridLocationProps {
	readonly left: GridLocationSchema.Type;
	readonly right: GridLocationSchema.Type;
}

/** Compares two concrete board/inventory/toolbar locations by their full identity. */
export const isSameGridLocationFn = ({ left, right }: SameGridLocationProps) => {
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
