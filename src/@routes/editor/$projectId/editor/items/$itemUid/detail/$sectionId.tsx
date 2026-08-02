import { createFileRoute } from "@tanstack/react-router";

import { EditorItemDetailSectionPage } from "~/ui/item/editor/EditorItemDetailSectionPage";
import { parseEditorItemSectionId } from "~/ui/item/editor/EditorItemSections";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/detail/$sectionId")({
	component: EditorItemDetailSectionRoute,
});

function EditorItemDetailSectionRoute() {
	const { itemUid, sectionId } = Route.useParams();
	return (
		<EditorItemDetailSectionPage
			sectionId={parseEditorItemSectionId(sectionId)}
			uid={itemUid}
		/>
	);
}
