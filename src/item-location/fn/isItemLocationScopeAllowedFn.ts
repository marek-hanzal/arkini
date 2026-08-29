import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { StorageSchema } from "~/engine/scope/schema/StorageSchema";

interface ItemLocationScopeAllowedProps {
	readonly item: ItemSchema.Type;
	readonly locationScope: GridLocationSchema.Type["scope"];
}

/**
 * Reads whether one canonical item may own one concrete passive-grid scope.
 *
 * The inventory opener is the one intentional Board/Toolbar utility item. Its
 * authored Board scope remains the automatic-placement policy, not permission
 * to store the opener inside Inventory itself.
 */
export const isItemLocationScopeAllowedFn = ({
	item,
	locationScope,
}: ItemLocationScopeAllowedProps) =>
	item.type === TypeSchema.enum.Inventory
		? locationScope === LocationScopeEnumSchema.enum.Board ||
			locationScope === LocationScopeEnumSchema.enum.Toolbar
		: item.scope === StorageSchema.enum.Any || item.scope === locationScope;
