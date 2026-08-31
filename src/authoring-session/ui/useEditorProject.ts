import { useAtom } from "@effect/atom-react";
import { Effect } from "effect";
import {
	createContext,
	createElement,
	useContext,
	useLayoutEffect,
	type PropsWithChildren,
} from "react";

import { EditorMcpProjectContextSchema } from "~electron/contract/editor/EditorMcpProjectContextSchema";
import type { Project } from "~/project-authoring/type/Project";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { readProjectFx } from "~/project-authoring/fx/readProjectFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

/** Carries the latest canonical repository snapshot through one mounted project route. */
const EditorProjectContext = createContext<Project | undefined>(undefined);

/** Publishes one committed repository snapshot to the mounted editor tree. */
export const EditorProjectProvider = ({
	children,
	loaded,
}: PropsWithChildren<{
	readonly loaded: Project;
}>) => {
	const [project, publishFn] = useAtom(EditorProjectAtom(loaded.projectId));
	useLayoutEffect(() => {
		const projectId = EditorMcpProjectContextSchema.parse(loaded.projectId);
		void RendererRuntime.runPromise(
			Effect.tryPromise({
				try: () => window.arkini.editorMcp.setProjectContextFn(projectId),
				catch: (cause) => cause,
			}),
		).catch((cause) =>
			console.error("Arkini editor MCP project context could not be set.", cause),
		);
		return () => {
			void RendererRuntime.runPromise(
				Effect.tryPromise({
					try: () => window.arkini.editorMcp.clearProjectContextFn(projectId),
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
		publishFn({
			project: loaded,
		});
	}, [
		loaded,
		publishFn,
	]);
	useLayoutEffect(() => {
		let mounted = true;
		const unsubscribeFn = window.arkini.editor.onProjectChangedFn((projectId) => {
			if (projectId !== loaded.projectId) return;
			void RendererRuntime.runPromise(
				readProjectFx({
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
			unsubscribeFn();
		};
	}, [
		loaded.projectId,
		publishFn,
	]);
	return createElement(EditorProjectContext, {
		children,
		value: project ?? loaded,
	});
};

/** Reads the latest canonical editor project snapshot published by its repository owner. */
export const useEditorProject = () => {
	const project = useContext(EditorProjectContext);
	if (project === undefined) throw new Error("Editor project provider is missing.");
	return project;
};
