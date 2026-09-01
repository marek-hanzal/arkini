import { createFileRoute, Outlet, useMatchRoute, useSearch } from "@tanstack/react-router";

import { EditorAssetDetail } from "~/asset-authoring/ui/EditorAssetDetail";

const FlatAssetDetailRoutes = [
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
		const flatContentActive = FlatAssetDetailRoutes.some((to) =>
			[
				true,
				false,
			].some(
				(pending) =>
					matchRouteFn({
						includeSearch: false,
						params: detailParams,
						pending,
						to,
					}) !== false,
			),
		);
		return (
			<EditorAssetDetail
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
