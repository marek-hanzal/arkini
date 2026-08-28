import { useAtom } from "@effect/atom-react";
import { useLayoutEffect, type PropsWithChildren } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorProjectContext } from "~/bridge/editor/EditorProjectContext";
import { publishEditorProjectFx } from "~/bridge/editor/publishEditorProjectFx";
import { readEditorProjectFx } from "~/bridge/editor/readEditorProjectFx";
import { clearEditorMcpProjectContextFx } from "~/bridge/editor-mcp/clearEditorMcpProjectContextFx";
import { setEditorMcpProjectContextFx } from "~/bridge/editor-mcp/setEditorMcpProjectContextFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Publishes one committed repository snapshot to the mounted editor tree. */
export const EditorProjectProvider = ({
	children,
	loaded,
}: PropsWithChildren<{
	readonly loaded: EditorProject;
}>) => {
	const [project, publish] = useAtom(EditorProjectAtom(loaded.projectId));
	useLayoutEffect(() => {
		void RendererRuntime.runPromise(setEditorMcpProjectContextFx(loaded.projectId)).catch(
			(cause) => console.error("Arkini editor MCP project context could not be set.", cause),
		);
		return () => {
			void RendererRuntime.runPromise(clearEditorMcpProjectContextFx(loaded.projectId)).catch(
				(cause) =>
					console.error("Arkini editor MCP project context could not be cleared.", cause),
			);
		};
	}, [
		loaded.projectId,
	]);
	useLayoutEffect(() => {
		publish({
			project: loaded,
		});
	}, [
		loaded,
		publish,
	]);
	useLayoutEffect(() => {
		let mounted = true;
		const unsubscribe = window.arkini.editor.onProjectChanged((projectId) => {
			if (projectId !== loaded.projectId) return;
			void RendererRuntime.runPromise(
				readEditorProjectFx({
					projectId,
				}),
			)
				.then((fresh) => {
					if (!mounted) return;
					return RendererRuntime.runPromise(
						publishEditorProjectFx(projectId, {
							project: fresh,
						}),
					);
				})
				.catch((cause) =>
					console.error(
						"Arkini editor project could not refresh after an MCP write.",
						cause,
					),
				);
		});
		return () => {
			mounted = false;
			unsubscribe();
		};
	}, [
		loaded.projectId,
		publish,
	]);
	return <EditorProjectContext value={project ?? loaded}>{children}</EditorProjectContext>;
};
