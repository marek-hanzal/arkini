import { Effect } from "effect";
import { createItemCatalogView } from "~/play/logic/createItemCatalogView";

export const readItemCatalogFx = Effect.fn("readItemCatalogFx")(function* () {
	return createItemCatalogView();
});
