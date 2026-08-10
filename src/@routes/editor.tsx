import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { readCurrentGameEngineResourceFx } from "~/bridge/game/readCurrentGameEngineResourceFx";
import { refreshEditorServiceStatusFx } from "~/bridge/editor/refreshEditorServiceStatusFx";
import { activateEditorMcpFx } from "~/bridge/editor-mcp/EditorMcpPort";

/** Editor routes never coexist with a live game resource; leave owns the final save first. */
export const Route = createFileRoute("/editor")({
	beforeLoad: async ({ context, location }) => {
		const resource = context.rendererRuntime.runSync(readCurrentGameEngineResourceFx());
		if (resource !== null) {
			throw redirect({
				to: "/game/$packageId/action/leave",
				params: {
					packageId: resource.game.arkpack.packageId,
				},
				search: {
					destination: "editor",
				},
				replace: true,
			});
		}
		const editorStatus = await context.rendererRuntime.runPromise(refreshEditorServiceStatusFx);
		if (editorStatus.type === "unavailable") {
			throw redirect({
				to: "/main-menu",
				replace: true,
			});
		}
		await context.rendererRuntime.runPromise(activateEditorMcpFx);
		if (location.pathname === "/editor" || location.pathname === "/editor/") {
			throw redirect({
				to: "/editor/welcome",
				replace: true,
			});
		}
	},
	component: Outlet,
});
