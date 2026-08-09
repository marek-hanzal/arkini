import { useAtom } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

import { EditorWelcomeCommandAtom } from "~/ui/editor/EditorWelcomeCommandAtom";

/** Owns editor-welcome navigation composition and Escape lifecycle. */
export const useEditorWelcomeActions = () => {
	const navigate = useNavigate();
	const [state, runCommand] = useAtom(EditorWelcomeCommandAtom);
	const active =
		state.kind === "pending" || state.kind === "ready" || state.kind === "navigating"
			? state.action
			: null;
	const blocked = active !== null;

	useEffect(() => {
		if (state.kind !== "ready") return;
		runCommand({
			action: "navigation-started",
		});
		const navigation =
			state.action === "exit"
				? navigate({
						to: "/main-menu",
					})
				: state.action === "create"
					? navigate({
							to: "/editor/$projectId/project/$sectionId",
							params: {
								projectId: state.project.projectId,
								sectionId: "general",
							},
						})
					: navigate({
							to: "/editor/$projectId/editor/items/list",
							params: {
								projectId: state.project.projectId,
							},
						});
		void navigation.then(
			() =>
				runCommand({
					action: "navigation-complete",
				}),
			(error: unknown) =>
				runCommand({
					action: "navigation-failed",
					error,
				}),
		);
	}, [
		navigate,
		runCommand,
		state,
	]);

	const createProject = useCallback(() => {
		if (blocked) return;
		runCommand({
			action: "create",
		});
	}, [
		blocked,
		runCommand,
	]);

	const importFile = useCallback(
		(file: File | undefined) => {
			if (file === undefined || blocked) return;
			runCommand({
				action: "import",
				file,
			});
		},
		[
			blocked,
			runCommand,
		],
	);

	const exit = useCallback(() => {
		if (blocked) return;
		runCommand({
			action: "exit",
		});
	}, [
		blocked,
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
