import { useAtomValue } from "@effect/atom-react";

import { ArkpackCatalogAtom } from "~/ui/arkpack/ArkpackCatalogAtom";
import type { ArkpackCatalog } from "~/renderer/arkpack/ArkpackCatalog";

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
