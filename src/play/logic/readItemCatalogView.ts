import { Effect } from "effect";
import { readItemCatalogFx } from "../fx/readItemCatalogFx";

export function readItemCatalogView() {
	return Effect.runSync(readItemCatalogFx());
}
