import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";

import { EditorItemDetail } from "~/ui/item/editor/EditorItemDetail";
import { parseEditorItemSectionId } from "~/ui/item/editor/EditorItemSections";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/detail")({
	component: EditorItemDetailRoute,
});

function EditorItemDetailRoute() {
	const { itemUid } = Route.useParams();
	const params = useParams({
		strict: false,
	});
	const sectionId = parseEditorItemSectionId(
		typeof params.sectionId === "string" ? params.sectionId : "identity",
	);
	return (
		<EditorItemDetail
			sectionId={sectionId}
			uid={itemUid}
		>
			<Outlet />
		</EditorItemDetail>
	);
}
