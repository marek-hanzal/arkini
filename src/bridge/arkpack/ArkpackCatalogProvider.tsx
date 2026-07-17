import type { PropsWithChildren } from "react";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { ArkpackCatalogContext } from "~/bridge/arkpack/ArkpackCatalogContext";

export namespace ArkpackCatalogProvider {
	export interface Props extends PropsWithChildren {
		readonly catalog: ArkpackCatalog;
	}
}

/** Exposes the one renderer Arkpack catalog owner to launcher UI. */
export const ArkpackCatalogProvider = ({ catalog, children }: ArkpackCatalogProvider.Props) => (
	<ArkpackCatalogContext.Provider value={catalog}>{children}</ArkpackCatalogContext.Provider>
);
