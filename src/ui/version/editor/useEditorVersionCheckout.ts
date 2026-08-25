import { useRouter } from "@tanstack/react-router";
import { useCallback, useState, useSyncExternalStore } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { checkoutEditorProjectVersionFx } from "~/bridge/editor/version/checkoutEditorProjectVersionFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorProjectVersionDescriptor } from "~/editor/version/EditorProjectVersion";
import { useEditorUnsavedChangesOwner } from "~/ui/editor/useEditorUnsavedChangesRegistration";

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

/** Owns destructive checkout admission, dirty-state confirmation, and terminal reload. */
export const useEditorVersionCheckout = ({
	project,
	projectDirty,
	reportError,
	selected,
}: useEditorVersionCheckout.Props): useEditorVersionCheckout.Output => {
	const router = useRouter();
	const unsavedOwner = useEditorUnsavedChangesOwner();
	const unsaved = useSyncExternalStore(
		unsavedOwner.subscribe,
		unsavedOwner.getSnapshot,
		unsavedOwner.getSnapshot,
	);
	const [confirmVersion, setConfirmVersion] = useState<EditorProjectVersionDescriptor>();
	const [pending, setPending] = useState(false);

	const runCheckout = useCallback(
		(version: EditorProjectVersionDescriptor) => {
			if (pending) return;
			setPending(true);
			reportError();
			void RendererRuntime.runPromise(
				checkoutEditorProjectVersionFx({
					currentProject: project,
					versionId: version.versionId,
				}),
			)
				.then(async () => {
					await router.navigate({
						to: "/editor/$projectId/versions/history",
						params: {
							projectId: project.projectId,
						},
						replace: true,
					});
					await router.invalidate();
				})
				.catch((cause) => {
					reportError(cause);
					setPending(false);
					setConfirmVersion(undefined);
				});
		},
		[
			pending,
			project,
			reportError,
			router,
		],
	);
	const restoreSelected = useCallback(() => {
		if (selected === undefined || selected.applicability.type === "incompatible") return;
		if (projectDirty || unsaved.hasDirtySession) {
			setConfirmVersion(selected);
			return;
		}
		runCheckout(selected);
	}, [
		projectDirty,
		runCheckout,
		selected,
		unsaved.hasDirtySession,
	]);
	const confirm = useCallback(() => {
		if (confirmVersion !== undefined) runCheckout(confirmVersion);
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
		pending,
		restoreSelected,
	};
};
