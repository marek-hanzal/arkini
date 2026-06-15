import { Effect } from "effect";
import { GameConfigServiceFx } from "~/v0/game/context/GameConfigServiceFx";
import { createItemCatalogViewFx } from "~/v0/item/fx/createItemCatalogViewFx";

export const readItemCatalogFx = Effect.fn("readItemCatalogFx")(function* () {
	const gameConfig = yield* GameConfigServiceFx;
	return yield* createItemCatalogViewFx({
		gameConfig,
	});
});
