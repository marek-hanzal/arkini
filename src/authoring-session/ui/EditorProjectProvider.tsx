import { useAtom } from "@effect/atom-react";
import { Effect } from "effect";
import { useLayoutEffect, type PropsWithChildren } from "react";

import { EditorMcpProjectContextSchema } from "../../../electron/contract/editor/EditorMcpProjectContextSchema";
import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { readEditorProjectFx } from "~/project-authoring/fx/readEditorProjectFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { EditorProjectContext } from "~/authoring-session/ui/useEditorProject";

/** Publishes one committed repository snapshot to the mounted editor tree. */
export const EditorProjectProvider = ({
	children,
	loaded,
}: PropsWithChildren<{
	readonly loaded: EditorProject;
}>) => {
	const [project, publish] = useAtom(EditorProjectAtom(loaded.projectId));
	useLayoutEffect(() => {
		const projectId = EditorMcpProjectContextSchema.parse(loaded.projectId);
		void RendererRuntime.runPromise(
			Effect.tryPromise({
				try: () => window.arkini.editorMcp.setProjectContext(projectId),
				catch: (cause) => cause,
			}),
		).catch((cause) =>
			console.error("Arkini editor MCP project context could not be set.", cause),
		);
		return () => {
			void RendererRuntime.runPromise(
				Effect.tryPromise({
					try: () => window.arkini.editorMcp.clearProjectContext(projectId),
					catch: (cause) => cause,
				}),
			).catch((cause) =>
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
