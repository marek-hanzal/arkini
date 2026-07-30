import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { readEditorProjectFx } from "~/bridge/editor/readEditorProjectFx";
import { EditorProjectErrorPage } from "~/page/editor/EditorProjectErrorPage";
import { EditorWorkspacePage } from "~/page/editor/EditorWorkspacePage";

const EditorProjectRoute = () => (
	<EditorWorkspacePage>
		<Outlet />
	</EditorWorkspacePage>
);

/** Compiles the complete standalone source workspace before any editor tool mounts. */
export const Route = createFileRoute("/editor/$projectId")({
	beforeLoad: ({ location, params }) => {
		const projectRoot = `/editor/${params.projectId}`;
		if (location.pathname !== projectRoot && location.pathname !== `${projectRoot}/`) return;
		throw redirect({
			to: "/editor/$projectId/editor",
			params,
			replace: true,
		});
	},
	staleTime: Number.POSITIVE_INFINITY,
	loader: ({ abortController, context, params }) =>
		context.rendererRuntime.runPromise(
			readEditorProjectFx({
				projectId: params.projectId,
			}),
			{
				signal: abortController.signal,
			},
		),
	component: EditorProjectRoute,
	errorComponent: EditorProjectErrorPage,
});
