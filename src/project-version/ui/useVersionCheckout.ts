import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useRouter } from "@tanstack/react-router";
import { useCallback, useState, useSyncExternalStore } from "react";

import type { Project } from "~/project-authoring/type/Project";
import { ProjectVersionCheckoutConfirmationRequired } from "~/project-version/error/ProjectVersionCheckoutConfirmationRequired";
import type { ProjectVersionDescriptor } from "~/project-version/type/ProjectVersion";
import { useEditorUnsavedChangesOwner } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { VersionRestoreCommandAtom } from "~/project-version/atom/VersionRestoreCommandAtom";

interface VersionCheckoutProps {
	readonly project: Project;
	readonly projectDirty: boolean;
	readonly reportErrorFn: (error?: unknown) => void;
}

interface VersionCheckoutOutput {
	readonly cancelFn: () => void;
	readonly confirmFn: () => void;
	readonly confirmVersion?: ProjectVersionDescriptor;
	readonly goToCommitFn: () => void;
	readonly pending: boolean;
	readonly restoreVersionFn: (version: ProjectVersionDescriptor) => void;
}

/** Owns destructive checkout admission and dirty-state confirmation. */
export const useVersionCheckout = ({
	project,
	projectDirty,
	reportErrorFn,
}: VersionCheckoutProps): VersionCheckoutOutput => {
	const router = useRouter();
	const restoreAtom = VersionRestoreCommandAtom(project.projectId);
	const restoreState = useAtomValue(restoreAtom);
	const restoreFn = useAtomSet(restoreAtom);
	const unsavedOwner = useEditorUnsavedChangesOwner();
	const unsaved = useSyncExternalStore(
		unsavedOwner.subscribeFn,
		unsavedOwner.getSnapshotFn,
		unsavedOwner.getSnapshotFn,
	);
	const [confirmVersion, setConfirmVersionFn] = useState<ProjectVersionDescriptor>();

	const runCheckoutFn = useCallback(
		(version: ProjectVersionDescriptor, confirmDiscardCurrentChanges: boolean) => {
			if (restoreState.kind === "restoring") return;
			reportErrorFn();
			restoreFn({
				confirmDiscardCurrentChanges,
				isNavigationPendingFn: () => router.state.status === "pending",
				onFailureFn: (cause) => {
					if (cause instanceof ProjectVersionCheckoutConfirmationRequired) {
						setConfirmVersionFn(version);
						return;
					}
					reportErrorFn(cause);
					setConfirmVersionFn(undefined);
				},
				subject: version.subject,
				versionId: version.versionId,
			});
		},
		[
			reportErrorFn,
			router,
			restoreFn,
			restoreState.kind,
		],
	);
	const restoreVersionFn = useCallback(
		(version: ProjectVersionDescriptor) => {
			if (projectDirty || unsaved.hasDirtySession) {
				setConfirmVersionFn(version);
				return;
			}
			runCheckoutFn(version, false);
		},
		[
			projectDirty,
			runCheckoutFn,
			unsaved.hasDirtySession,
		],
	);
	const confirmFn = useCallback(() => {
		if (confirmVersion !== undefined) runCheckoutFn(confirmVersion, true);
	}, [
		confirmVersion,
		runCheckoutFn,
	]);
	const goToCommitFn = useCallback(() => {
		setConfirmVersionFn(undefined);
		void router.navigate({
			to: "/editor/$projectId/versions/commit",
			params: {
				projectId: project.projectId,
			},
			search: {
				returnTo: `/editor/${project.projectId}/versions/history`,
			},
		});
	}, [
		project.projectId,
		router,
	]);

	return {
		cancelFn: () => setConfirmVersionFn(undefined),
		confirmFn,
		...(confirmVersion === undefined
			? {}
			: {
					confirmVersion,
				}),
		goToCommitFn,
		pending: restoreState.kind === "restoring",
		restoreVersionFn,
	};
};
