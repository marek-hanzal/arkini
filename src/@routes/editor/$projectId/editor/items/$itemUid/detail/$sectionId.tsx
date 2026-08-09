import { createFileRoute } from "@tanstack/react-router";

import { EditorItemDetailSectionPage } from "~/ui/item/editor/EditorItemDetailSectionPage";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { parseEditorItemSectionIdFx } from "~/ui/item/editor/parseEditorItemSectionIdFx";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/detail/$sectionId")({
	component: EditorItemDetailSectionRoute,
});

function EditorItemDetailSectionRoute() {
	const { itemUid, sectionId } = Route.useParams();
	return (
		<EditorItemDetailSectionPage
			sectionId={RendererRuntime.runSync(parseEditorItemSectionIdFx(sectionId))}
			uid={itemUid}
		/>
	);
}
