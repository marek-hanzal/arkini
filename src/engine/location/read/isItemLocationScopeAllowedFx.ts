import { Effect } from "effect";

import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";

export namespace isItemLocationScopeAllowedFx {
	export interface Props {
		readonly item: ItemSchema.Type;
		readonly locationScope: GridLocationSchema.Type["scope"];
	}
}

/**
 * Reads whether one canonical item may own one concrete passive-grid scope.
 *
 * The inventory opener is the one intentional Board/Toolbar utility item. Its
 * authored Board scope remains the automatic-placement policy, not permission
 * to store the opener inside Inventory itself.
 */
export const isItemLocationScopeAllowedFx = Effect.fn("isItemLocationScopeAllowedFx")(function* ({
	item,
	locationScope,
}: isItemLocationScopeAllowedFx.Props) {
	return item.type === ItemEnumSchema.enum.Inventory
		? locationScope === LocationScopeEnumSchema.enum.Board ||
				locationScope === LocationScopeEnumSchema.enum.Toolbar
		: item.scope === StorageScopeEnumSchema.enum.Any || item.scope === locationScope;
});
