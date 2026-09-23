import { createFileRoute, Outlet, useMatchRoute, useSearch } from "@tanstack/react-router";

import { EditorArtworkSectionHelp } from "~/artwork-authoring/ui/EditorArtworkSectionHelp";
import { EditorArtworkDetail } from "~/artwork-authoring/ui/EditorArtworkDetail";

export const Route = createFileRoute("/editor/$projectId/artwork/$resourceUid/detail")({
	component: () => {
		const { projectId, resourceUid } = Route.useParams();
		const matchRouteFn = useMatchRoute();
		const search = useSearch({
			from: "/editor/$projectId/artwork",
		});
		const detailParams = {
			projectId,
			resourceUid,
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
						to: `/editor/$projectId/artwork/$resourceUid/detail/${section}`,
						params: detailParams,
						pending: false,
						includeSearch: false,
					}) !== false,
			) ?? "overview";
		return (
			<EditorArtworkDetail
				help={EditorArtworkSectionHelp[section]}
				contentMode={section === "overview" || section === "notes" ? "viewport" : "scroll"}
				filter={search.filter ?? "all"}
				query={search.query ?? ""}
				resourceUid={resourceUid}
			>
				<Outlet />
			</EditorArtworkDetail>
		);
	},
});
