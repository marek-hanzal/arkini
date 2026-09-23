import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import type { ArtworkSchema } from "~/item-definition/schema/ArtworkSchema";

interface CheatItemCatalogEntry {
	readonly itemUid: IdSchema.Type;
	readonly sourceResourceUids: ArtworkSchema.Type["default"];
	readonly title: string;
}

/** Reads the immutable Board-spawnable item catalog for Cheat Spotlight. */
export const readCheatItemCatalogFx = Effect.fn("readCheatItemCatalogFx")(function* () {
	const config = yield* GameConfigFx;
	return Object.values(config.items)
		.map(
			(item): CheatItemCatalogEntry => ({
				itemUid: item.uid,
				sourceResourceUids: item.artwork.default,
				title: item.title,
			}),
		)
		.sort(
			(first, second) =>
				first.title.localeCompare(second.title) ||
				first.itemUid.localeCompare(second.itemUid),
		);
});
