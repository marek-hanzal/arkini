import { readItemCatalogFx } from "../fx/readItemCatalogFx";
import { runEffect } from "./runEffect";

export function readItemCatalogView() {
	return runEffect(readItemCatalogFx());
}
