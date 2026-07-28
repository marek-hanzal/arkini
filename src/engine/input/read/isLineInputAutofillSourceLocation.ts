import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

/** Identifies physical source scopes that one board line may draw from through autofill. */
export const isLineInputAutofillSourceLocation = ({
	location,
	ownerSpace,
}: {
	readonly location: GridLocationSchema.Type;
	readonly ownerSpace: number;
}) =>
	(location.scope === LocationScopeEnumSchema.enum.Board && location.space === ownerSpace) ||
	location.scope === LocationScopeEnumSchema.enum.Inventory ||
	location.scope === LocationScopeEnumSchema.enum.Toolbar;
