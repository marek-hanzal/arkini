import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";

import { EditorItemDetail } from "~/item-authoring/ui/EditorItemDetail";
import type { EditorItemSectionId } from "~/item-authoring/ui/EditorItemSections";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/detail")({
	component: () => {
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
	},
});
