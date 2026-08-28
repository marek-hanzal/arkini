import { getRouteApi, useNavigate } from "@tanstack/react-router";

import { EditorGameFlow } from "~/ui/item/editor/EditorGameFlow";

const flowRoute = getRouteApi("/editor/$projectId/flow");

export const EditorFlowPage = () => {
	const { projectId } = flowRoute.useParams();
	const search = flowRoute.useSearch();
	const navigate = useNavigate({
		from: "/editor/$projectId/flow",
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
};
