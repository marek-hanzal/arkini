import { useAtom } from "@effect/atom-react";
import { useLayoutEffect, type PropsWithChildren } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorProjectContext } from "~/bridge/editor/EditorProjectContext";
import {
	clearEditorMcpProjectContextFx,
	setEditorMcpProjectContextFx,
} from "~/bridge/editor-mcp/EditorMcpPort";
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
	return <EditorProjectContext value={project ?? loaded}>{children}</EditorProjectContext>;
};
