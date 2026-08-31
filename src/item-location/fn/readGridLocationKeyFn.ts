import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

/** Encodes one concrete grid cell into the canonical location identity key. */
export const readGridLocationKeyFn = (location: GridLocationSchema.Type) => {
	const position = `${location.position.x}:${location.position.y}`;
	return location.scope === LocationScopeEnumSchema.enum.Board
		? `${location.scope}:${location.space}:${position}`
		: `${location.scope}:${position}`;
};
