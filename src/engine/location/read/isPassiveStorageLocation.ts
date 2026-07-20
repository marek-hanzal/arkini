import type { LocationSchema } from "~/engine/location/schema/LocationSchema";

/** Identifies grid locations where gameplay time and spatial behavior are paused. */
export const isPassiveStorageLocation = (location: LocationSchema.Type) =>
	location.scope === "inventory" || location.scope === "toolbar";
