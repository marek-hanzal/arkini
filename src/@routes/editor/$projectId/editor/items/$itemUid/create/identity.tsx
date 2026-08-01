import { createFileRoute } from "@tanstack/react-router";

import { EditorItemSectionPage } from "~/ui/item/editor/EditorItemSectionPage";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/create/identity")({
	component: EditorItemCreateSectionRoute,
});

function EditorItemCreateSectionRoute() {
	return <EditorItemSectionPage section="identity" />;
}
