import { useAtom } from "@effect/atom-react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { EditorWelcomeCommandAtom } from "~/project-authoring/atom/EditorWelcomeCommandAtom";

/** Owns editor-welcome navigation composition and Escape lifecycle. */
export const useEditorWelcomeActions = ({ exitBlocked = false } = {}) => {
	const navigateFn = useNavigate();
	const router = useRouter();
	const [state, runCommandFn] = useAtom(EditorWelcomeCommandAtom);
	const [deletedProjectIds, setDeletedProjectIdsFn] = useState<ReadonlySet<string>>(
		() => new Set(),
	);
	const [projectRefreshError, setProjectRefreshErrorFn] = useState<unknown>();
	const [refreshingProjects, setRefreshingProjectsFn] = useState(false);
	const active =
		state.kind === "pending" || state.kind === "ready" || state.kind === "navigating"
			? state.action
			: null;
	const blocked = active !== null || refreshingProjects;

	const refreshProjectsFn = useCallback(async () => {
		setRefreshingProjectsFn(true);
		try {
			await router.invalidate();
			setDeletedProjectIdsFn(new Set());
			setProjectRefreshErrorFn(undefined);
		} catch (error) {
			setProjectRefreshErrorFn(error);
		} finally {
			setRefreshingProjectsFn(false);
		}
	}, [
		router,
	]);

	useEffect(() => {
		if (state.kind !== "ready") return;
		runCommandFn({
			action: "navigation-started",
		});
		if (state.action === "delete-project") {
			setDeletedProjectIdsFn((current) => new Set(current).add(state.projectId));
			void refreshProjectsFn().finally(() =>
				runCommandFn({
					action: "navigation-complete",
				}),
			);
			return;
		}
		const navigation =
			state.action === "exit"
				? navigateFn({
						to: "/main-menu",
					})
				: state.action === "create"
					? navigateFn({
							to: "/editor/$projectId/project/form/$sectionId",
							params: {
								projectId: state.project.projectId,
								sectionId: "general",
							},
						})
					: navigateFn({
							to: "/editor/$projectId/editor/items/list",
							params: {
								projectId: state.project.projectId,
							},
						});
		void navigation.then(
			() =>
				runCommandFn({
					action: "navigation-complete",
				}),
			(error: unknown) =>
				runCommandFn({
					action: "navigation-failed",
					error,
				}),
		);
	}, [
		navigateFn,
		refreshProjectsFn,
		runCommandFn,
		state,
	]);

	const createProjectFn = useCallback((projectId: string) => {
		if (blocked) return;
		runCommandFn({
			action: "create",
			projectId,
		});
	}, [
		blocked,
		runCommandFn,
	]);

	const importArkpackFileFn = useCallback(
		(file: File | undefined) => {
			if (file === undefined || blocked) return;
			runCommandFn({
				action: "import-arkpack",
				file,
			});
		},
		[
			blocked,
			runCommandFn,
		],
	);

	const importJsonDirectoryFn = useCallback(() => {
		if (blocked) return;
		runCommandFn({
			action: "import-json",
		});
	}, [
		blocked,
		runCommandFn,
	]);

	const deleteProjectFn = useCallback(
		(projectId: string) => {
			if (blocked) return;
			runCommandFn({
				action: "delete-project",
				projectId,
			});
		},
		[
			blocked,
			runCommandFn,
		],
	);

	const openProjectFolderFn = useCallback(
		(root: string) => {
			if (blocked) return;
			runCommandFn({
				action: "open-project-folder",
				root,
			});
		},
		[
			blocked,
			runCommandFn,
		],
	);

	const exitFn = useCallback(() => {
		if (blocked) return;
		runCommandFn({
			action: "exit",
		});
	}, [
		blocked,
		runCommandFn,
	]);

	useEffect(() => {
		const onKeyDownFn = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || blocked || exitBlocked) return;
			event.preventDefault();
			exitFn();
		};
		window.addEventListener("keydown", onKeyDownFn);
		return () => window.removeEventListener("keydown", onKeyDownFn);
	}, [
		blocked,
		exitFn,
		exitBlocked,
	]);

	return {
		active,
		blocked,
		createProjectFn,
		deletedProjectIds,
		deleteProjectFn,
		error: state.kind === "error" ? state.error : undefined,
		exitFn,
		importArkpackFileFn,
		importJsonDirectoryFn,
		openProjectFolderFn,
		projectRefreshError,
		refreshingProjects,
		refreshProjectsFn,
	};
};
