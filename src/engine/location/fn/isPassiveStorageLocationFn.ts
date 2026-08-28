import type { LocationSchema } from "~/engine/location/schema/LocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

/** Reads whether gameplay time and spatial behavior pause at one exact location. */
export const isPassiveStorageLocationFn = (location: LocationSchema.Type) =>
	location.scope === LocationScopeEnumSchema.enum.Inventory ||
	location.scope === LocationScopeEnumSchema.enum.Toolbar;
