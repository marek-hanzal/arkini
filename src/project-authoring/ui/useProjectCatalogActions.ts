import { useAtom } from "@effect/atom-react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { ProjectCatalogCommandAtom } from "~/project-authoring/atom/ProjectCatalogCommandAtom";

/** Owns project catalog commands and navigation across the Your games surface. */
export const useProjectCatalogActions = () => {
	const navigateFn = useNavigate();
	const router = useRouter();
	const [state, runCommandFn] = useAtom(ProjectCatalogCommandAtom);
	const [deletedProjectIds, setDeletedProjectIdsFn] = useState<ReadonlySet<string>>(
		() => new Set(),
	);
	const [dismissedProjectRoots, setDismissedProjectRootsFn] = useState<ReadonlySet<string>>(
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
			setDismissedProjectRootsFn(new Set());
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
		if (state.action === "delete-project" || state.action === "dismiss-invalid-project") {
			if (state.action === "delete-project")
				setDeletedProjectIdsFn((current) => new Set(current).add(state.projectId));
			else setDismissedProjectRootsFn((current) => new Set(current).add(state.root));
			void refreshProjectsFn().finally(() =>
				runCommandFn({
					action: "navigation-complete",
				}),
			);
			return;
		}
		const navigation =
			state.action === "create"
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

	const createProjectFn = useCallback(
		(projectId: string) => {
			if (blocked) return;
			runCommandFn({
				action: "create",
				projectId,
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

	const dismissInvalidProjectFn = useCallback(
		(root: string) => {
			if (blocked) return;
			runCommandFn({
				action: "dismiss-invalid-project",
				root,
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

	return {
		active,
		blocked,
		createProjectFn,
		deletedProjectIds,
		deleteProjectFn,
		dismissInvalidProjectFn,
		dismissedProjectRoots,
		error: state.kind === "error" ? state.error : undefined,
		importJsonDirectoryFn,
		openProjectFolderFn,
		projectRefreshError,
		refreshingProjects,
		refreshProjectsFn,
	};
};
