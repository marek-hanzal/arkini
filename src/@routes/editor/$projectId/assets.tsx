import { createFileRoute } from "@tanstack/react-router";

import { AssetCatalogFilterSchema } from "~/asset-authoring/schema/AssetCatalogFilterSchema";

interface EditorAssetsSearch {
	readonly filter?: AssetCatalogFilterSchema.Type;
	readonly query?: string;
}

export const Route = createFileRoute("/editor/$projectId/assets")({
	validateSearch: (search): EditorAssetsSearch => ({
		filter: AssetCatalogFilterSchema.catch("all").parse(search.filter),
		query: typeof search.query === "string" ? search.query : "",
	}),
});
