import { use } from "react";
import { ArkpackCatalogContext } from "~/bridge/arkpack/ArkpackCatalogContext";

/** Reads the one shared renderer Arkpack catalog owner. */
export const useArkpackCatalog = () => {
	const catalog = use(ArkpackCatalogContext);
	if (catalog === undefined) {
		throw new Error("useArkpackCatalog must run beneath ArkpackCatalogProvider.");
	}
	return catalog;
};
