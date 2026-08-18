import { createFileRoute } from "@tanstack/react-router";

import { EditorFlowPage } from "~/page/editor/EditorFlowPage";
import type { EditorOriginFlowDirection } from "~/ui/item/editor/readEditorOriginFlowHighlightFx";

interface EditorFlowRouteSearch {
	readonly direction: EditorOriginFlowDirection;
	readonly itemId?: string;
}

const EditorFlowRoute = () => {
	const search = Route.useSearch();
	return (
		<EditorFlowPage
			direction={search.direction}
			itemId={search.itemId}
		/>
	);
};

export const Route = createFileRoute("/editor/$projectId/flow")({
	component: EditorFlowRoute,
	validateSearch: (search): EditorFlowRouteSearch => ({
		direction: search.direction === "output" ? "output" : "input",
		...(typeof search.itemId === "string" && search.itemId.length > 0
			? {
					itemId: search.itemId,
				}
			: {}),
	}),
});
