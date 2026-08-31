import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";

import { EditorAssetManager } from "~/asset-authoring/ui/EditorAssetManager";

const assetsRouteId = "/editor/$projectId/assets" as const;

export const Route = createFileRoute("/editor/$projectId/assets/")({
	component: () => {
		const search = useSearch({
			from: assetsRouteId,
		});
		const navigateFn = useNavigate({
			from: Route.fullPath,
		});
		return (
			<EditorAssetManager
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
