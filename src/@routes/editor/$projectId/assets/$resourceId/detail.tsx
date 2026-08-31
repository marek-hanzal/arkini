import { createFileRoute, Outlet, useSearch } from "@tanstack/react-router";

import { EditorAssetDetail } from "~/asset-authoring/ui/EditorAssetDetail";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/detail")({
	component: () => {
		const { resourceId } = Route.useParams();
		const search = useSearch({
			from: "/editor/$projectId/assets",
		});
		return (
			<EditorAssetDetail
				filter={search.filter ?? "all"}
				query={search.query ?? ""}
				resourceId={resourceId}
			>
				<Outlet />
			</EditorAssetDetail>
		);
	},
});
