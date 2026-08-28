import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Effect } from "effect";

import { releaseCurrentEditorBoardGameFx } from "~/bridge/editor/board/releaseCurrentEditorBoardGameFx";
import { syncEditorBoardGameFx } from "~/bridge/editor/board/syncEditorBoardGameFx";
import type { EditorProject } from "~/bridge/editor/EditorProject";
import { readEditorProjectFx } from "~/bridge/editor/readEditorProjectFx";
import { EditorProjectErrorPage } from "~/page/editor/EditorProjectErrorPage";
import { EditorProjectShellPage } from "~/page/editor/EditorProjectShellPage";

const syncRoutedEditorBoardGameFx = Effect.fn("syncRoutedEditorBoardGameFx")(
	(project: EditorProject | undefined) =>
		project === undefined ? releaseCurrentEditorBoardGameFx : syncEditorBoardGameFx(project),
);

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
		void context.rendererRuntime
			.runPromise(syncRoutedEditorBoardGameFx(loaderData))
			.catch((cause) =>
				console.error("Arkini editor Board game could not be synchronized.", cause),
			);
	},
	onStay: ({ context, loaderData }) => {
		void context.rendererRuntime
			.runPromise(syncRoutedEditorBoardGameFx(loaderData))
			.catch((cause) =>
				console.error("Arkini editor Board game could not be synchronized.", cause),
			);
	},
	onLeave: ({ context }) => {
		void context.rendererRuntime
			.runPromise(releaseCurrentEditorBoardGameFx)
			.catch((cause) =>
				console.error("Arkini editor Board game could not be released.", cause),
			);
	},
	shouldReload: ({ cause }) => cause === "enter",
	component: EditorProjectRoute,
	errorComponent: EditorProjectErrorPage,
});
