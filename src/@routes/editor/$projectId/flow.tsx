import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { EditorGameFlow } from "~/flow/ui/EditorGameFlow";
import type { OriginFlowDirection } from "~/flow/ui/Highlight";

interface EditorFlowRouteSearch {
	readonly direction: OriginFlowDirection;
	readonly itemId?: string;
}

export const Route = createFileRoute("/editor/$projectId/flow")({
	validateSearch: (search): EditorFlowRouteSearch => ({
		direction: search.direction === "output" ? "output" : "input",
		...(typeof search.itemId === "string" && search.itemId.length > 0
			? {
					itemId: search.itemId,
				}
			: {}),
	}),
	component: () => {
		const { projectId } = Route.useParams();
		const search = Route.useSearch();
		const navigate = useNavigate({
			from: Route.fullPath,
		});
		return (
			<EditorGameFlow
				direction={search.direction}
				itemId={search.itemId}
				projectId={projectId}
				onDirectionChange={(direction) =>
					navigate({
						replace: true,
						search: (current) => ({
							...current,
							direction,
						}),
					})
				}
				onItemIdChange={(itemId) =>
					navigate({
						replace: true,
						search: (current) => ({
							...current,
							itemId: itemId.length === 0 ? undefined : itemId,
						}),
					})
				}
			/>
		);
	},
});
