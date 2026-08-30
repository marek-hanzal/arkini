import { createFileRoute } from "@tanstack/react-router";

interface EditorAssetsSearch {
	readonly filter?: "all" | "unused";
	readonly query?: string;
}

export const Route = createFileRoute("/editor/$projectId/assets")({
	validateSearch: (search): EditorAssetsSearch => ({
		filter: search.filter === "unused" ? "unused" : "all",
		query: typeof search.query === "string" ? search.query : "",
	}),
});
