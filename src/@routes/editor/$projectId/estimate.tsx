import { createFileRoute } from "@tanstack/react-router";

import type { EditorItemEstimateSortSchema } from "~/editor/EditorItemEstimateSortSchema";
import { EditorEstimatePage } from "~/page/editor/EditorEstimatePage";

interface EditorEstimateRouteSearch {
	readonly query?: string;
	readonly sort?: EditorItemEstimateSortSchema.Type;
}

export const Route = createFileRoute("/editor/$projectId/estimate")({
	validateSearch: (search): EditorEstimateRouteSearch => ({
		query:
			typeof search.query === "string" && search.query.length > 0 ? search.query : undefined,
		sort: search.sort === "demand" || search.sort === "slowest" ? search.sort : undefined,
	}),
	component: EditorEstimatePage,
});
