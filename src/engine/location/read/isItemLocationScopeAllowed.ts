import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";

/**
 * Reads whether one canonical item may own one concrete passive-grid scope.
 *
 * The inventory opener is the one intentional Board/Toolbar utility item. Its
 * authored Board scope remains the automatic-placement policy, not permission
 * to store the opener inside Inventory itself.
 */
export const isItemLocationScopeAllowed = (
	item: ItemSchema.Type,
	locationScope: GridLocationSchema.Type["scope"],
) =>
	item.type === ItemEnumSchema.enum.Inventory
		? locationScope === LocationScopeEnumSchema.enum.Board ||
			locationScope === LocationScopeEnumSchema.enum.Toolbar
		: item.scope === StorageScopeEnumSchema.enum.Any || item.scope === locationScope;
