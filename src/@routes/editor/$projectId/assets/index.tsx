import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";

import { EditorAssetsPage } from "~/page/editor/EditorAssetsPage";

const assetsRouteId = "/editor/$projectId/assets" as const;

export const Route = createFileRoute("/editor/$projectId/assets/")({
	component: EditorAssetsIndexRoute,
});

function EditorAssetsIndexRoute() {
	const search = useSearch({
		from: assetsRouteId,
	});
	const navigate = useNavigate({
		from: Route.fullPath,
	});
	return (
		<EditorAssetsPage
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
}
