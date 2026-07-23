import type { LocationSchema } from "~/engine/location/schema/LocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

/** Identifies grid locations where gameplay time and spatial behavior are paused. */
export const isPassiveStorageLocation = (location: LocationSchema.Type) =>
	location.scope === LocationScopeEnumSchema.enum.Inventory ||
	location.scope === LocationScopeEnumSchema.enum.Toolbar;
