import { createFileRoute, Outlet } from "@tanstack/react-router";

import { EditorItemEditPage } from "~/page/editor/EditorItemEditPage";

export const Route = createFileRoute(
	"/editor/$projectId/editor/items/$itemUid/edit",
)({
	component: EditorItemEditRoute,
});

function EditorItemEditRoute() {
	const { itemUid } = Route.useParams();
	return (
		<EditorItemEditPage uid={itemUid}>
			<Outlet />
		</EditorItemEditPage>
	);
}
