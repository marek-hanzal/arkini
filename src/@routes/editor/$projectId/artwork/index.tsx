import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";

import { EditorArtworkManager } from "~/artwork-authoring/ui/EditorArtworkManager";

const artworkRouteId = "/editor/$projectId/artwork" as const;

export const Route = createFileRoute("/editor/$projectId/artwork/")({
	component: () => {
		const search = useSearch({
			from: artworkRouteId,
		});
		const navigateFn = useNavigate({
			from: Route.fullPath,
		});
		return (
			<EditorArtworkManager
				filter={search.filter ?? "all"}
				query={search.query ?? ""}
				onFilterChangeFn={(filter) =>
					void navigateFn({
						replace: true,
						search: (current) => ({
							...current,
							filter,
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
