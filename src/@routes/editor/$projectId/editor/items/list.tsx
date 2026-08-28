import { createFileRoute } from "@tanstack/react-router";

import { EditorItemTypes, type EditorItemType } from "~/bridge/item/editor/EditorItemModel";
import { EditorItemsPage } from "~/page/editor/EditorItemsPage";

interface EditorItemsRouteSearch {
	readonly itemType?: EditorItemType;
	readonly query?: string;
}

export const Route = createFileRoute("/editor/$projectId/editor/items/list")({
	validateSearch: (search): EditorItemsRouteSearch => ({
		itemType:
			EditorItemTypes.find((type) => type === search.itemType) === undefined
				? undefined
				: (search.itemType as EditorItemType),
		query:
			typeof search.query === "string" && search.query.length > 0 ? search.query : undefined,
	}),
	component: EditorItemsPage,
});
