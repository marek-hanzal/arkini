import { Effect } from "effect";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { createItemCatalogView } from "~/play/logic/createItemCatalogView";

export const readItemCatalogFx = Effect.fn("readItemCatalogFx")(function* () {
	const gameConfig = yield* GameConfigServiceFx;
	return createItemCatalogView({
		gameConfig,
	});
});
