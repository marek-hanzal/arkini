import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { EditorProjectProvider } from "~/bridge/editor/EditorProjectProvider";
import { loadEditorProjectFx } from "~/bridge/editor/loadEditorProjectFx";
import { EditorProjectErrorPage } from "~/page/editor/EditorProjectErrorPage";
import { EditorWorkspacePage } from "~/page/editor/EditorWorkspacePage";
import { EditorProjectResourceUrlProvider } from "~/ui/resource/editor/useEditorResourceUrl";

const EditorProjectRoute = () => {
	const { expectedRevision, project } = Route.useLoaderData();
	return (
		<EditorProjectProvider
			expectedRevision={expectedRevision}
			loaded={project}
		>
			<EditorProjectResourceUrlProvider>
				<EditorWorkspacePage>
					<Outlet />
				</EditorWorkspacePage>
			</EditorProjectResourceUrlProvider>
		</EditorProjectProvider>
	);
};

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
	loader: {
		handler: ({ abortController, context, params }) =>
			context.rendererRuntime.runPromise(
				loadEditorProjectFx({
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
