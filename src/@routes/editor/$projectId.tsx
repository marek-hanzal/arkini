import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Effect } from "effect";

import { releaseCurrentEditorBoardGameFx } from "~/board-scenario/session/releaseCurrentEditorBoardGameFx";
import { syncEditorBoardGameFx } from "~/board-scenario/session/syncEditorBoardGameFx";
import type { EditorProject } from "~/project-authoring/EditorProject";
import { EditorProjectProvider } from "~/authoring-session/EditorProjectProvider";
import { readEditorProjectFx } from "~/project-authoring/readEditorProjectFx";
import { ButtonLink } from "~/ui/button/Button";
import { EditorProjectReplacementBoundary } from "~/authoring-session/EditorProjectReplacementBoundary";
import { EditorShell } from "~/authoring-shell/EditorShell";
import { EditorProjectResourceUrlProvider } from "~/ui/resource/editor/EditorResourceUrlProvider";
import { EditorVersionRestoreAction } from "~/project-version/workspace/EditorVersionRestoreAction";

const syncRoutedEditorBoardGameFx = Effect.fn("syncRoutedEditorBoardGameFx")(
	(project: EditorProject | undefined) =>
		project === undefined ? releaseCurrentEditorBoardGameFx : syncEditorBoardGameFx(project),
);

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
	component: () => {
		const project = Route.useLoaderData();
		return (
			<EditorProjectProvider loaded={project}>
				<EditorVersionRestoreAction projectId={project.projectId} />
				<EditorProjectReplacementBoundary>
					<EditorProjectResourceUrlProvider>
						<EditorShell>
							<Outlet />
						</EditorShell>
					</EditorProjectResourceUrlProvider>
				</EditorProjectReplacementBoundary>
			</EditorProjectProvider>
		);
	},
	errorComponent: ({ error }) => (
		<main
			className="grid h-dvh place-items-center bg-canvas p-[var(--ak-viewport-padding)] text-foreground"
			data-ui="EditorProjectErrorPage"
		>
			<section className="w-full max-w-xl rounded-2xl border border-danger/40 bg-surface p-6 shadow-2xl">
				<h1 className="text-2xl font-semibold">Editor project could not be opened</h1>
				<p className="mt-3 break-words text-sm leading-6 text-danger">
					{error instanceof Error ? error.message : String(error)}
				</p>
				<div className="mt-6 flex flex-wrap gap-3">
					<ButtonLink to="/editor/welcome">Editor welcome</ButtonLink>
					<ButtonLink to="/main-menu">Main menu</ButtonLink>
				</div>
			</section>
		</main>
	),
});
