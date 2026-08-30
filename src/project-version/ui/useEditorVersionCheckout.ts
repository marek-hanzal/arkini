import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useRouter } from "@tanstack/react-router";
import { useCallback, useState, useSyncExternalStore } from "react";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { EditorProjectVersionCheckoutConfirmationRequired } from "~/project-version/error/EditorProjectVersionCheckoutConfirmationRequired";
import type { EditorProjectVersionDescriptor } from "~/project-version/type/EditorProjectVersion";
import { useEditorUnsavedChangesOwner } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { EditorVersionRestoreCommandAtom } from "~/project-version/atom/EditorVersionRestoreCommandAtom";

export namespace useEditorVersionCheckout {
	export interface Props {
		readonly project: EditorProject;
		readonly projectDirty: boolean;
		readonly reportError: (error?: unknown) => void;
		readonly selected?: EditorProjectVersionDescriptor;
	}

	export interface Output {
		readonly cancel: () => void;
		readonly confirm: () => void;
		readonly confirmVersion?: EditorProjectVersionDescriptor;
		readonly goToCommit: () => void;
		readonly pending: boolean;
		readonly restoreSelected: () => void;
	}
}

/** Owns destructive checkout admission and dirty-state confirmation. */
export const useEditorVersionCheckout = ({
	project,
	projectDirty,
	reportError,
	selected,
}: useEditorVersionCheckout.Props): useEditorVersionCheckout.Output => {
	const router = useRouter();
	const restoreAtom = EditorVersionRestoreCommandAtom(project.projectId);
	const restoreState = useAtomValue(restoreAtom);
	const restore = useAtomSet(restoreAtom);
	const unsavedOwner = useEditorUnsavedChangesOwner();
	const unsaved = useSyncExternalStore(
		unsavedOwner.subscribe,
		unsavedOwner.getSnapshot,
		unsavedOwner.getSnapshot,
	);
	const [confirmVersion, setConfirmVersion] = useState<EditorProjectVersionDescriptor>();

	const runCheckout = useCallback(
		(version: EditorProjectVersionDescriptor, confirmDiscardCurrentChanges: boolean) => {
			if (restoreState.kind === "restoring") return;
			reportError();
			restore({
				confirmDiscardCurrentChanges,
				onFailure: (cause) => {
					if (cause instanceof EditorProjectVersionCheckoutConfirmationRequired) {
						setConfirmVersion(version);
						return;
					}
					reportError(cause);
					setConfirmVersion(undefined);
				},
				subject: version.subject,
				versionId: version.versionId,
			});
		},
		[
			reportError,
			restore,
			restoreState.kind,
		],
	);
	const restoreSelected = useCallback(() => {
		if (selected === undefined) return;
		if (projectDirty || unsaved.hasDirtySession) {
			setConfirmVersion(selected);
			return;
		}
		runCheckout(selected, false);
	}, [
		projectDirty,
		runCheckout,
		selected,
		unsaved.hasDirtySession,
	]);
	const confirm = useCallback(() => {
		if (confirmVersion !== undefined) runCheckout(confirmVersion, true);
	}, [
		confirmVersion,
		runCheckout,
	]);
	const goToCommit = useCallback(() => {
		setConfirmVersion(undefined);
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
		cancel: () => setConfirmVersion(undefined),
		confirm,
		...(confirmVersion === undefined
			? {}
			: {
					confirmVersion,
				}),
		goToCommit,
		pending: restoreState.kind === "restoring",
		restoreSelected,
	};
};
