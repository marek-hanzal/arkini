import { useAtomValue } from "@effect/atom-react";

import { ArkpackCatalogAtom } from "~/bridge/arkpack/ArkpackCatalogAtom";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";

export namespace useArkpacks {
	export type State = ArkpackCatalog.State;

	export interface Result {
		readonly state: State;
	}
}

/** Reads the one root-owned Arkpack catalog without creating another cache. */
export const useArkpacks = (): useArkpacks.Result => {
	const state = useAtomValue(ArkpackCatalogAtom);

	return {
		state,
	};
};
