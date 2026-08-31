import { useAtomValue } from "@effect/atom-react";

import { CatalogAtom } from "~/arkpack-catalog/atom/CatalogAtom";
import type { ArkpackCatalog } from "~/arkpack-catalog/service/ArkpackCatalog";

interface UseArkpacksResult {
	readonly state: ArkpackCatalog.State;
}

/** Reads the one root-owned Arkpack catalog without creating another cache. */
export const useArkpacks = (): UseArkpacksResult => {
	const state = useAtomValue(CatalogAtom);

	return {
		state,
	};
};
