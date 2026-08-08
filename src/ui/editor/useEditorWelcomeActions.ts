import { useAtom } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Effect } from "effect";
import { useCallback, useEffect } from "react";

import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";
import { EditorWelcomeCommandAtom } from "~/ui/editor/EditorWelcomeCommandAtom";

/** Owns editor-welcome navigation composition and Escape lifecycle. */
export const useEditorWelcomeActions = () => {
	const navigate = useNavigate();
	const [state, runCommand] = useAtom(EditorWelcomeCommandAtom);
	const active = state.kind === "pending" ? state.action : null;
	const blocked = active !== null;
	const openProjectSettingsFx = useCallback(
		(project: EditorProjectDescriptor) =>
			Effect.tryPromise({
				try: () =>
					navigate({
						to: "/editor/$projectId/project/$sectionId",
						params: {
							projectId: project.projectId,
							sectionId: "general",
						},
					}),
				catch: (cause) => cause,
			}),
		[
			navigate,
		],
	);

	const createProject = useCallback(() => {
		if (blocked) return;
		runCommand({
			action: "create",
			navigateFx: openProjectSettingsFx,
		});
	}, [
		blocked,
		openProjectSettingsFx,
		runCommand,
	]);

	const importFile = useCallback(
		(file: File | undefined) => {
			if (file === undefined || blocked) return;
			runCommand({
				action: "import",
				file,
				navigateFx: (project: EditorProjectDescriptor) =>
					Effect.tryPromise({
						try: () =>
							navigate({
								to: "/editor/$projectId/editor/items/list",
								params: {
									projectId: project.projectId,
								},
							}),
						catch: (cause) => cause,
					}),
			});
		},
		[
			blocked,
			navigate,
			runCommand,
		],
	);

	const exit = useCallback(() => {
		if (blocked) return;
		runCommand({
			action: "exit",
			navigateFx: Effect.tryPromise({
				try: () =>
					navigate({
						to: "/main-menu",
					}),
				catch: (cause) => cause,
			}),
		});
	}, [
		blocked,
		navigate,
		runCommand,
	]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || blocked) return;
			event.preventDefault();
			exit();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		blocked,
		exit,
	]);

	return {
		active,
		blocked,
		createProject,
		error: state.kind === "error" ? state.error : undefined,
		exit,
		importFile,
	};
};
