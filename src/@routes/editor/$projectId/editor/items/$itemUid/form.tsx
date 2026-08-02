import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";

import { EditorItemTypeSchema, type EditorItemType } from "~/bridge/item/editor/EditorItemModel";
import { EditorItemFormPage } from "~/page/editor/EditorItemFormPage";
import { parseEditorItemSectionId } from "~/ui/item/editor/EditorItemSections";

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
	const params = useParams({
		strict: false,
	});
	return (
		<EditorItemFormPage
			itemType={itemType}
			sectionId={parseEditorItemSectionId(
				typeof params.sectionId === "string" ? params.sectionId : "identity",
			)}
			uid={itemUid}
		>
			<Outlet />
		</EditorItemFormPage>
	);
}
