import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";

import { EditorItemTypeSchema, type EditorItemType } from "~/bridge/item/editor/EditorItemModel";
import { EditorItemFormPage } from "~/page/editor/EditorItemFormPage";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorItemOptionalCapability } from "~/ui/item/editor/EditorItemSections";
import { parseEditorItemSectionIdFx } from "~/ui/item/editor/parseEditorItemSectionIdFx";

interface EditorItemFormSearch {
	readonly enable?: EditorItemOptionalCapability;
	readonly itemType?: EditorItemType;
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
	}),
	component: EditorItemFormRoute,
});

function EditorItemFormRoute() {
	const { itemUid } = Route.useParams();
	const { enable, itemType } = Route.useSearch();
	const params = useParams({
		strict: false,
	});
	return (
		<EditorItemFormPage
			enableCapability={enable}
			itemType={itemType}
			sectionId={RendererRuntime.runSync(
				parseEditorItemSectionIdFx(
					typeof params.sectionId === "string" ? params.sectionId : "identity",
				),
			)}
			uid={itemUid}
		>
			<Outlet />
		</EditorItemFormPage>
	);
}
