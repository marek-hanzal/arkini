import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { prepareEditorGameHandoffFx } from "~/bridge/game/prepareEditorGameHandoffFx";
import { refreshEditorServiceStatusFx } from "~/bridge/editor/refreshEditorServiceStatusFx";

/** Joins installed ownership; active Games still leave through their final-save route. */
export const Route = createFileRoute("/editor")({
	beforeLoad: async ({ abortController, context, location, preload }) => {
		if (preload) return;
		const resource = await context.rendererRuntime.runPromise(prepareEditorGameHandoffFx, {
			signal: abortController.signal,
		});
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
		const editorStatus = await context.rendererRuntime.runPromise(
			refreshEditorServiceStatusFx,
			{
				signal: abortController.signal,
			},
		);
		if (editorStatus.type === "unavailable") {
			throw redirect({
				to: "/main-menu",
				replace: true,
			});
		}
		if (location.pathname === "/editor" || location.pathname === "/editor/") {
			throw redirect({
				to: "/editor/welcome",
				replace: true,
			});
		}
	},
	component: Outlet,
});
