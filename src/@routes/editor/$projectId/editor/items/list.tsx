import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { selectItemCollectionFn } from "~/item-authoring/fn/selectItemCollectionFn";
import { List } from "~/item-authoring/ui/List";

interface EditorItemsRouteSearch {
	readonly query?: string;
	readonly view?: selectItemCollectionFn.View;
}

export const Route = createFileRoute("/editor/$projectId/editor/items/list")({
	validateSearch: (search): EditorItemsRouteSearch => ({
		view: search.view === "with-note" ? search.view : undefined,
		query:
			typeof search.query === "string" && search.query.length > 0 ? search.query : undefined,
	}),
	component: () => {
		const search = Route.useSearch();
		const navigateFn = useNavigate({
			from: Route.fullPath,
		});

		return (
			<List
				query={search.query ?? ""}
				view={search.view ?? "name"}
				onViewChangeFn={(view) =>
					void navigateFn({
						replace: true,
						search: (current) => ({
							...current,
							view: view === "name" ? undefined : view,
						}),
					})
				}
				onQueryChangeFn={(query) =>
					void navigateFn({
						replace: true,
						search: (current) => ({
							...current,
							query,
						}),
					})
				}
			/>
		);
	},
});
