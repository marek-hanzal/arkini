import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import type { AssetSchema } from "~/item-definition/schema/AssetSchema";
import { StorageSchema } from "~/item-definition/schema/StorageSchema";

interface CheatItemCatalogEntry {
	readonly itemId: IdSchema.Type;
	readonly sourceResourceIds: AssetSchema.Type["default"];
	readonly title: string;
}

/** Reads the immutable Board-spawnable item catalog for Cheat Spotlight. */
export const readCheatItemCatalogFx = Effect.fn("readCheatItemCatalogFx")(function* () {
	const config = yield* GameConfigFx;
	return Object.values(config.items)
		.filter(
			(item) =>
				item.scope === StorageSchema.enum.Board || item.scope === StorageSchema.enum.Any,
		)
		.map(
			(item): CheatItemCatalogEntry => ({
				itemId: item.id,
				sourceResourceIds: item.asset.default,
				title: item.title,
			}),
		)
		.sort(
			(first, second) =>
				first.title.localeCompare(second.title) ||
				first.itemId.localeCompare(second.itemId),
		);
});
