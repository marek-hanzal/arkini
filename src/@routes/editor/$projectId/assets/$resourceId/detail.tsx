import { createFileRoute, Outlet, useMatchRoute, useSearch } from "@tanstack/react-router";

import { EditorAssetSectionHelp } from "~/asset-authoring/ui/EditorAssetSectionHelp";
import { EditorAssetDetail } from "~/asset-authoring/ui/EditorAssetDetail";

const FlatAssetDetailRoutes = [
	"/editor/$projectId/assets/$resourceId/detail/notes",
	"/editor/$projectId/assets/$resourceId/detail/usage",
	"/editor/$projectId/assets/$resourceId/detail/delete",
] as const;

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
		const flatContentActive = FlatAssetDetailRoutes.some(
			(to) =>
				matchRouteFn({
					includeSearch: false,
					params: detailParams,
					pending: false,
					to,
				}) !== false,
		);
		const section =
			(
				[
					"usage",
					"technical",
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
				contentVariant={flatContentActive ? "flat" : "card"}
				filter={search.filter ?? "all"}
				query={search.query ?? ""}
				resourceId={resourceId}
			>
				<Outlet />
			</EditorAssetDetail>
		);
	},
});
