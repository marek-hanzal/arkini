import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { List } from "~/item-authoring/ui/List";

interface EditorItemsRouteSearch {
	readonly draft?: true;
	readonly query?: string;
}

export const Route = createFileRoute("/editor/$projectId/editor/items/list")({
	validateSearch: (search): EditorItemsRouteSearch => ({
		draft: search.draft === true ? true : undefined,
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
				draft={search.draft === true}
				query={search.query ?? ""}
				onDraftChangeFn={(draft) =>
					void navigateFn({
						replace: true,
						search: (current) => ({
							...current,
							draft: draft ? true : undefined,
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
