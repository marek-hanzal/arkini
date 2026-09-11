import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

/** Encodes one concrete grid slot (layered only on the Board) into the canonical location identity key. */
export const readGridLocationKeyFn = (
	location: GridLocationSchema.Type,
	layer: ItemSchema.Type["layer"],
) => {
	const position = `${location.position.x}:${location.position.y}`;
	return location.scope === LocationScopeEnumSchema.enum.Board
		? `${location.scope}:${location.space}:${position}:${layer}`
		: `${location.scope}:${position}`;
};
