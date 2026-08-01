import { createFileRoute, Outlet } from "@tanstack/react-router";

import { EditorItemTypeSchema, type EditorItemType } from "~/bridge/item/editor/EditorItemModel";
import { EditorItemFormPage } from "~/page/editor/EditorItemFormPage";

interface EditorItemFormSearch {
	readonly itemType?: EditorItemType;
}

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/form")({
	validateSearch: (search): EditorItemFormSearch => ({
		...(search.itemType === undefined
			? {}
			: {
					itemType: EditorItemTypeSchema.parse(search.itemType),
				}),
	}),
	component: EditorItemFormRoute,
});

function EditorItemFormRoute() {
	const { itemUid } = Route.useParams();
	const { itemType } = Route.useSearch();
	return (
		<EditorItemFormPage
			itemType={itemType}
			uid={itemUid}
		>
			<Outlet />
		</EditorItemFormPage>
	);
}
