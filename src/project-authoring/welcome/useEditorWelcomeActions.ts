import { useAtom } from "@effect/atom-react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { EditorWelcomeCommandAtom } from "~/project-authoring/welcome/EditorWelcomeCommandAtom";

/** Owns editor-welcome navigation composition and Escape lifecycle. */
export const useEditorWelcomeActions = ({ exitBlocked = false } = {}) => {
	const navigate = useNavigate();
	const router = useRouter();
	const [state, runCommand] = useAtom(EditorWelcomeCommandAtom);
	const [deletedProjectIds, setDeletedProjectIds] = useState<ReadonlySet<string>>(
		() => new Set(),
	);
	const [projectRefreshError, setProjectRefreshError] = useState<unknown>();
	const [refreshingProjects, setRefreshingProjects] = useState(false);
	const active =
		state.kind === "pending" || state.kind === "ready" || state.kind === "navigating"
			? state.action
			: null;
	const blocked = active !== null || refreshingProjects;

	const refreshProjects = useCallback(async () => {
		setRefreshingProjects(true);
		try {
			await router.invalidate();
			setDeletedProjectIds(new Set());
			setProjectRefreshError(undefined);
		} catch (error) {
			setProjectRefreshError(error);
		} finally {
			setRefreshingProjects(false);
		}
	}, [
		router,
	]);

	useEffect(() => {
		if (state.kind !== "ready") return;
		runCommand({
			action: "navigation-started",
		});
		if (state.action === "delete-project") {
			setDeletedProjectIds((current) => new Set(current).add(state.projectId));
			void refreshProjects().finally(() =>
				runCommand({
					action: "navigation-complete",
				}),
			);
			return;
		}
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
		refreshProjects,
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

	const importArkpackFile = useCallback(
		(file: File | undefined) => {
			if (file === undefined || blocked) return;
			runCommand({
				action: "import-arkpack",
				file,
			});
		},
		[
			blocked,
			runCommand,
		],
	);

	const importJsonDirectory = useCallback(() => {
		if (blocked) return;
		runCommand({
			action: "import-json",
		});
	}, [
		blocked,
		runCommand,
	]);

	const deleteProject = useCallback(
		(projectId: string) => {
			if (blocked) return;
			runCommand({
				action: "delete-project",
				projectId,
			});
		},
		[
			blocked,
			runCommand,
		],
	);

	const openProjectFolder = useCallback(
		(root: string) => {
			if (blocked) return;
			runCommand({
				action: "open-project-folder",
				root,
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
			if (event.key !== "Escape" || blocked || exitBlocked) return;
			event.preventDefault();
			exit();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		blocked,
		exit,
		exitBlocked,
	]);

	return {
		active,
		blocked,
		createProject,
		deletedProjectIds,
		deleteProject,
		error: state.kind === "error" ? state.error : undefined,
		exit,
		importArkpackFile,
		importJsonDirectory,
		openProjectFolder,
		projectRefreshError,
		refreshingProjects,
		refreshProjects,
	};
};
