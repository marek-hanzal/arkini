import { createFileRoute } from "@tanstack/react-router";

import { EditorItemSectionPage } from "~/ui/item/editor/EditorItemSectionPage";

export const Route = createFileRoute(
	"/editor/$projectId/editor/items/$itemUid/edit/merges",
)({
	component: EditorItemEditSectionRoute,
});

function EditorItemEditSectionRoute() {
	return <EditorItemSectionPage section="merges" />;
}
