import { createFileRoute } from "@tanstack/react-router";

import { ArtworkCatalogFilterSchema } from "~/artwork-authoring/schema/ArtworkCatalogFilterSchema";

interface EditorArtworkSearch {
	readonly filter?: ArtworkCatalogFilterSchema.Type;
	readonly query?: string;
}

export const Route = createFileRoute("/editor/$projectId/artwork")({
	validateSearch: (search): EditorArtworkSearch => ({
		filter: ArtworkCatalogFilterSchema.catch("all").parse(search.filter),
		query: typeof search.query === "string" ? search.query : "",
	}),
});
