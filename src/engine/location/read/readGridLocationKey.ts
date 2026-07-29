import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

/** Encodes one concrete grid cell with its surface and Board space identity. */
export const readGridLocationKey = (location: GridLocationSchema.Type) => {
	const position = `${location.position.x}:${location.position.y}`;
	return location.scope === LocationScopeEnumSchema.enum.Board
		? `${location.scope}:${location.space}:${position}`
		: `${location.scope}:${position}`;
};
