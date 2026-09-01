import { createFileRoute, Outlet, useMatchRoute, useSearch } from "@tanstack/react-router";

import { EditorAssetDetail } from "~/asset-authoring/ui/EditorAssetDetail";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/detail")({
	component: () => {
		const { projectId, resourceId } = Route.useParams();
		const matchRouteFn = useMatchRoute();
		const search = useSearch({
			from: "/editor/$projectId/assets",
		});
		const usageParams = {
			projectId,
			resourceId,
		};
		const usageActive = [
			true,
			false,
		].some(
			(pending) =>
				matchRouteFn({
					includeSearch: false,
					params: usageParams,
					pending,
					to: "/editor/$projectId/assets/$resourceId/detail/usage",
				}) !== false,
		);
		return (
			<EditorAssetDetail
				contentVariant={usageActive ? "flat" : "card"}
				filter={search.filter ?? "all"}
				query={search.query ?? ""}
				resourceId={resourceId}
			>
				<Outlet />
			</EditorAssetDetail>
		);
	},
});
