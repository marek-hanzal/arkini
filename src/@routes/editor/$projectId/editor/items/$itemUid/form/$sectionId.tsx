import { createFileRoute } from "@tanstack/react-router";

import { EditorItemSectionPage } from "~/ui/item/editor/EditorItemSectionPage";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { parseEditorItemSectionIdFx } from "~/ui/item/editor/parseEditorItemSectionIdFx";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/form/$sectionId")({
	component: EditorItemFormSectionRoute,
});

function EditorItemFormSectionRoute() {
	const { sectionId } = Route.useParams();
	return (
		<EditorItemSectionPage
			section={RendererRuntime.runSync(parseEditorItemSectionIdFx(sectionId))}
		/>
	);
}
