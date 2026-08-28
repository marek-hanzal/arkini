import { Effect } from "effect";

import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { StorageSchema } from "~/engine/scope/schema/StorageSchema";

export namespace isItemLocationScopeAllowedFx {
	export interface Props {
		readonly item: ItemSchema.Type;
		readonly locationScope: GridLocationSchema.Type["scope"];
	}
}

/** Checks passive-grid scope permission without allocating an Effect in indexed scans. */
const isItemLocationScopeAllowed = ({ item, locationScope }: isItemLocationScopeAllowedFx.Props) =>
	item.type === TypeSchema.enum.Inventory
		? locationScope === LocationScopeEnumSchema.enum.Board ||
			locationScope === LocationScopeEnumSchema.enum.Toolbar
		: item.scope === StorageSchema.enum.Any || item.scope === locationScope;

/**
 * Reads whether one canonical item may own one concrete passive-grid scope.
 *
 * The inventory opener is the one intentional Board/Toolbar utility item. Its
 * authored Board scope remains the automatic-placement policy, not permission
 * to store the opener inside Inventory itself.
 */
export const isItemLocationScopeAllowedFx = Effect.fnUntraced(function* ({
	item,
	locationScope,
}: isItemLocationScopeAllowedFx.Props) {
	return isItemLocationScopeAllowed({
		item,
		locationScope,
	});
});
