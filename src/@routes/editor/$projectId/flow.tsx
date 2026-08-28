import { createFileRoute } from "@tanstack/react-router";

import { EditorFlowPage } from "~/page/editor/EditorFlowPage";
import type { OriginFlowDirection } from "~/ui/item/editor/origin-flow/Highlight";

interface EditorFlowRouteSearch {
	readonly direction: OriginFlowDirection;
	readonly itemId?: string;
}

export const Route = createFileRoute("/editor/$projectId/flow")({
	component: EditorFlowPage,
	validateSearch: (search): EditorFlowRouteSearch => ({
		direction: search.direction === "output" ? "output" : "input",
		...(typeof search.itemId === "string" && search.itemId.length > 0
			? {
					itemId: search.itemId,
				}
			: {}),
	}),
});
