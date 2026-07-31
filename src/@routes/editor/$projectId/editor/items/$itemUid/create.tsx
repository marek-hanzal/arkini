import { createFileRoute } from "@tanstack/react-router";

import { parseEditorItemType } from "~/bridge/item/editor/EditorItemModel";
import { EditorItemCreatePage } from "~/page/editor/EditorItemCreatePage";

export const Route = createFileRoute(
	"/editor/$projectId/editor/items/$itemUid/create",
)({
	validateSearch: (search) => ({
		itemType: parseEditorItemType(search.itemType),
	}),
	component: EditorCreateItemRoute,
});

function EditorCreateItemRoute() {
	const { itemUid } = Route.useParams();
	const { itemType } = Route.useSearch();
	return (
		<EditorItemCreatePage
			itemType={itemType}
			uid={itemUid}
		/>
	);
}
