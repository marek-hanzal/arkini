import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";

/** Encodes one concrete grid cell into the canonical location identity key. */
export const readGridLocationKeyFn = (location: BoardLocationSchema.Type) =>
	`${location.scope}:${location.space}:${location.position.x}:${location.position.y}`;
