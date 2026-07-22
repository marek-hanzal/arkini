import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";

export interface CheatItemCatalogEntry {
	readonly itemId: IdSchema.Type;
	readonly title: string;
	readonly categoryId: IdSchema.Type;
	readonly tags: readonly string[];
	readonly sourceResourceId: IdSchema.Type;
}

/** Reads the immutable Board-spawnable item catalog for Cheat Spotlight. */
export const readCheatItemCatalogFx = Effect.fn("readCheatItemCatalogFx")(function* () {
	const config = yield* GameConfigFx;
	return Object.values(config.items)
		.filter((item) => item.scope === StorageScopeEnumSchema.enum.Board || item.scope === StorageScopeEnumSchema.enum.Any)
		.map(
			(item): CheatItemCatalogEntry => ({
				itemId: item.id,
				title: item.title,
				categoryId: item.categoryId,
				tags: [
					...item.tags,
				],
				sourceResourceId: item.asset.source[0],
			}),
		)
		.sort(
			(first, second) =>
				first.title.localeCompare(second.title) ||
				first.itemId.localeCompare(second.itemId),
		);
});
