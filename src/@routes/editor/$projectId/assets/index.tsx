import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";

import { EditorAssetManager } from "~/asset-authoring/ui/EditorAssetManager";

const assetsRouteId = "/editor/$projectId/assets" as const;

export const Route = createFileRoute("/editor/$projectId/assets/")({
	component: () => {
		const search = useSearch({
			from: assetsRouteId,
		});
		const navigate = useNavigate({
			from: Route.fullPath,
		});
		return (
			<EditorAssetManager
				filter={search.filter ?? "all"}
				query={search.query ?? ""}
				onFilterChange={(filter) =>
					void navigate({
						replace: true,
						search: (current) => ({
							...current,
							filter,
						}),
					})
				}
				onQueryChange={(query) =>
					void navigate({
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
