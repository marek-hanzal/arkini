import { Effect } from "effect";
import { GameConfigServiceFx } from "~/v0/game/context/GameConfigServiceFx";
import { createItemCatalogView } from "~/v0/item/fx/createItemCatalogView";

export const readItemCatalogFx = Effect.fn("readItemCatalogFx")(function* () {
	const gameConfig = yield* GameConfigServiceFx;
	return createItemCatalogView({
		gameConfig,
	});
});
