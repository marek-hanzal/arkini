import { useAtomValue } from "@effect/atom-react";

import { ArkpackCatalogAtom } from "~/arkpack-selector/atom/ArkpackCatalogAtom";
import type { ArkpackCatalog } from "~/arkpack-catalog/service/ArkpackCatalog";

export namespace useArkpacks {
	export type State = ArkpackCatalog.State;
}

interface UseArkpacksResult {
	readonly state: useArkpacks.State;
}

/** Reads the one root-owned Arkpack catalog without creating another cache. */
export const useArkpacks = (): UseArkpacksResult => {
	const state = useAtomValue(ArkpackCatalogAtom);

	return {
		state,
	};
};
