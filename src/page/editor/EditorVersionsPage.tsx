import { Outlet } from "@tanstack/react-router";

import { EditorVersions } from "~/ui/version/editor/EditorVersions";

export const EditorVersionsPage = () => (
	<EditorVersions>
		<Outlet />
	</EditorVersions>
);
