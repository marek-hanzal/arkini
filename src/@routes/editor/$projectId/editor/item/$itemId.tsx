import { createFileRoute } from "@tanstack/react-router";

import { EditorItemFormPage } from "~/page/editor/EditorItemFormPage";

export const Route = createFileRoute("/editor/$projectId/editor/item/$itemId")({
	component: EditorItemRoute,
});

function EditorItemRoute() {
	const { itemId } = Route.useParams();
	return (
		<EditorItemFormPage
			mode="edit"
			itemId={itemId}
		/>
	);
}
