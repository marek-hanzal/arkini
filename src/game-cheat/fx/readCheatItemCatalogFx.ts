import { Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { StorageSchema } from "~/item-definition/schema/StorageSchema";

interface CheatItemCatalogEntry {
	readonly itemId: IdSchema.Type;
	readonly title: string;
	readonly sourceResourceId: IdSchema.Type;
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
				title: item.title,
				sourceResourceId: item.asset.default[0],
			}),
		)
		.sort(
			(first, second) =>
				first.title.localeCompare(second.title) ||
				first.itemId.localeCompare(second.itemId),
		);
});
