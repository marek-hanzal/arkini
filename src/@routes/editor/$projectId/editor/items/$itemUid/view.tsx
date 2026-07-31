import { createFileRoute } from "@tanstack/react-router";

import { EditorItemViewPage } from "~/page/editor/EditorItemViewPage";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/view")({
	component: EditorItemViewRoute,
});

function EditorItemViewRoute() {
	const { itemUid } = Route.useParams();
	return <EditorItemViewPage uid={itemUid} />;
}
