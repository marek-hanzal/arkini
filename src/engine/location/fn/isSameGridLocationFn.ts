import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace isSameGridLocationFn {
	export interface Props {
		readonly left: GridLocationSchema.Type;
		readonly right: GridLocationSchema.Type;
	}
}

/** Compares two concrete board/inventory/toolbar locations by their full identity. */
export const isSameGridLocationFn = ({ left, right }: isSameGridLocationFn.Props) => {
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
