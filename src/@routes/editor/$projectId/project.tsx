import { createFileRoute, Outlet } from "@tanstack/react-router";

import { EditorProjectPage } from "~/page/editor/EditorProjectPage";

export const Route = createFileRoute("/editor/$projectId/project")({
	component: EditorProjectRoute,
});

function EditorProjectRoute() {
	return (
		<EditorProjectPage>
			<Outlet />
		</EditorProjectPage>
	);
}
