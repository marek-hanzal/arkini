import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";

import { EditorItemDetailPage } from "~/page/editor/EditorItemDetailPage";
import type { EditorItemSectionId } from "~/page/editor/parseEditorItemSectionIdFx";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/detail")({
	component: EditorItemDetailRoute,
});

function EditorItemDetailRoute() {
	const { itemUid } = Route.useParams();
	const params = useParams({
		strict: false,
	});
	const sectionId = (
		typeof params.sectionId === "string" ? params.sectionId : "identity"
	) as EditorItemSectionId;
	return (
		<EditorItemDetailPage
			sectionId={sectionId}
			uid={itemUid}
		>
			<Outlet />
		</EditorItemDetailPage>
	);
}
