import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { StorageSchema } from "~/item-definition/schema/StorageSchema";

interface ItemLocationScopeAllowedProps {
	readonly item: ItemSchema.Type;
	readonly locationScope: GridLocationSchema.Type["scope"];
}

/** Reads whether the authored scope permits one concrete grid location. */
export const isItemLocationScopeAllowedFn = ({
	item,
	locationScope,
}: ItemLocationScopeAllowedProps) =>
	item.scope === StorageSchema.enum.Any || item.scope === locationScope;
