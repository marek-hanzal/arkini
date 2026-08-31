import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { EditorGameFlow } from "~/flow-canvas/ui/EditorGameFlow";
import type { OriginFlowDirection } from "~/flow-canvas/type/Highlight";

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
		const navigateFn = useNavigate({
			from: Route.fullPath,
		});
		return (
			<EditorGameFlow
				direction={search.direction}
				itemId={search.itemId}
				projectId={projectId}
				onDirectionChangeFn={(direction) =>
					navigateFn({
						replace: true,
						search: (current) => ({
							...current,
							direction,
						}),
					})
				}
				onItemIdChangeFn={(itemId) =>
					navigateFn({
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
