import { useAtomValue } from "@effect/atom-react";

import { CatalogAtom } from "~/serapack-catalog/atom/CatalogAtom";
import type { SerapackCatalog } from "~/serapack-catalog/service/SerapackCatalog";

interface UseSerapacksResult {
	readonly state: SerapackCatalog.State;
}

/** Reads the one root-owned Serapack catalog without creating another cache. */
export const useSerapacks = (): UseSerapacksResult => {
	const state = useAtomValue(CatalogAtom);

	return {
		state,
	};
};
