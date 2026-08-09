import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";

import type { EditorItemSectionId } from "~/ui/item/editor/EditorItemSections";
import { EditorItemDetail } from "~/ui/item/editor/EditorItemDetail";

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
		<EditorItemDetail
			sectionId={sectionId}
			uid={itemUid}
		>
			<Outlet />
		</EditorItemDetail>
	);
}
