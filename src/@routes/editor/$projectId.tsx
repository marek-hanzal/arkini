import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { releaseEditorBoardGameFx } from "~/bridge/editor/board/releaseEditorBoardGameFx";
import { syncEditorBoardGameFx } from "~/bridge/editor/board/syncEditorBoardGameFx";
import { readEditorProjectFx } from "~/bridge/editor/readEditorProjectFx";
import { EditorProjectErrorPage } from "~/page/editor/EditorProjectErrorPage";
import { EditorProjectShellPage } from "~/page/editor/EditorProjectShellPage";

const EditorProjectRoute = () => {
	const project = Route.useLoaderData();
	return (
		<EditorProjectShellPage project={project}>
			<Outlet />
		</EditorProjectShellPage>
	);
};

/** Loads the canonical project before any editor tool mounts. */
export const Route = createFileRoute("/editor/$projectId")({
	beforeLoad: ({ location, params }) => {
		const projectRoot = `/editor/${params.projectId}`;
		if (location.pathname !== projectRoot && location.pathname !== `${projectRoot}/`) return;
		throw redirect({
			to: "/editor/$projectId/editor/items/list",
			params,
			replace: true,
		});
	},
	loader: {
		handler: ({ abortController, context, params }) =>
			context.rendererRuntime.runPromise(
				readEditorProjectFx({
					projectId: params.projectId,
				}),
				{
					signal: abortController.signal,
				},
			),
		staleReloadMode: "blocking",
	},
	onEnter: ({ context, loaderData }) => {
		if (loaderData === undefined) return;
		void context.rendererRuntime
			.runPromise(syncEditorBoardGameFx(loaderData))
			.catch((cause) =>
				console.error("Arkini editor Board game could not be started.", cause),
			);
	},
	onLeave: ({ context, params }) => {
		void context.rendererRuntime
			.runPromise(releaseEditorBoardGameFx(params.projectId))
			.catch((cause) =>
				console.error("Arkini editor Board game could not be released.", cause),
			);
	},
	shouldReload: ({ cause }) => cause === "enter",
	component: EditorProjectRoute,
	errorComponent: EditorProjectErrorPage,
});
