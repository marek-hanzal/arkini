import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

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
	shouldReload: ({ cause }) => cause === "enter",
	component: EditorProjectRoute,
	errorComponent: EditorProjectErrorPage,
});
