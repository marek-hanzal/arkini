import { createFileRoute, useSearch } from "@tanstack/react-router";

import { EditorAssetEdit } from "~/asset-authoring/ui/EditorAssetEdit";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/edit")({
	component: () => {
		const { resourceId } = Route.useParams();
		const search = useSearch({
			from: "/editor/$projectId/assets",
		});
		return (
			<EditorAssetEdit
				key={resourceId}
				filter={search.filter ?? "all"}
				query={search.query ?? ""}
				resourceId={resourceId}
			/>
		);
	},
});
