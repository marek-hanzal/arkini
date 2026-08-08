import { createFileRoute } from "@tanstack/react-router";

import { EditorItemSectionPage } from "~/ui/item/editor/EditorItemSectionPage";
import { parseEditorItemSectionId } from "~/ui/item/editor/EditorItemSections";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/form/$sectionId")({
	component: EditorItemFormSectionRoute,
});

function EditorItemFormSectionRoute() {
	const { sectionId } = Route.useParams();
	return <EditorItemSectionPage section={parseEditorItemSectionId(sectionId)} />;
}
