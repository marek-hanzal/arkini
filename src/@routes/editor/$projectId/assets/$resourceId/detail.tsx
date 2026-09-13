import { createFileRoute, Outlet, useMatchRoute, useSearch } from "@tanstack/react-router";

import { EditorAssetSectionHelp } from "~/asset-authoring/ui/EditorAssetSectionHelp";
import { EditorAssetDetail } from "~/asset-authoring/ui/EditorAssetDetail";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/detail")({
	component: () => {
		const { projectId, resourceId } = Route.useParams();
		const matchRouteFn = useMatchRoute();
		const search = useSearch({
			from: "/editor/$projectId/assets",
		});
		const detailParams = {
			projectId,
			resourceId,
		};
		const section =
			(
				[
					"usage",
					"notes",
					"delete",
				] as const
			).find(
				(section) =>
					matchRouteFn({
						to: `/editor/$projectId/assets/$resourceId/detail/${section}`,
						params: detailParams,
						pending: false,
						includeSearch: false,
					}) !== false,
			) ?? "overview";
		return (
			<EditorAssetDetail
				help={EditorAssetSectionHelp[section]}
				contentMode={section === "overview" || section === "notes" ? "viewport" : "scroll"}
				filter={search.filter ?? "all"}
				query={search.query ?? ""}
				resourceId={resourceId}
			>
				<Outlet />
			</EditorAssetDetail>
		);
	},
});
