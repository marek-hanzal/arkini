import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";

import { EditorItemTypeSchema, type EditorItemType } from "~/bridge/item/editor/EditorItemModel";
import { EditorItemFormPage } from "~/page/editor/EditorItemFormPage";
import type { EditorItemSectionId } from "~/page/editor/parseEditorItemSectionIdFx";

type EditorItemOptionalCapability = "charges" | "merges";

interface EditorItemFormSearch {
	readonly enable?: EditorItemOptionalCapability;
	readonly itemType?: EditorItemType;
	readonly lineId?: string;
}

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/form")({
	validateSearch: (search): EditorItemFormSearch => ({
		...(search.enable === "charges" || search.enable === "merges"
			? {
					enable: search.enable,
				}
			: {}),
		...(search.itemType === undefined
			? {}
			: {
					itemType: EditorItemTypeSchema.parse(search.itemType),
				}),
		...(typeof search.lineId === "string" && search.lineId.length > 0
			? {
					lineId: search.lineId,
				}
			: {}),
	}),
	component: EditorItemFormRoute,
});

function EditorItemFormRoute() {
	const { itemUid } = Route.useParams();
	const { enable, itemType, lineId } = Route.useSearch();
	const params = useParams({
		strict: false,
	});
	const sectionId = (
		typeof params.sectionId === "string" ? params.sectionId : "identity"
	) as EditorItemSectionId;
	return (
		<EditorItemFormPage
			enableCapability={enable}
			itemType={itemType}
			productionLineId={lineId}
			sectionId={sectionId}
			uid={itemUid}
		>
			<Outlet />
		</EditorItemFormPage>
	);
}
