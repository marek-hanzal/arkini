import { useBlocker } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useEditorUnsavedChangesOwner } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";

export namespace useEditorNavigationBlocker {
	export interface Output {
		readonly promptOpen: boolean;
	}
}

/** Holds the routed session through replacement or identity rename and checks its dirty drafts. */
export const useEditorNavigationBlocker = (): useEditorNavigationBlocker.Output => {
	const owner = useEditorUnsavedChangesOwner();
	const writeAdmission = RendererRuntime.runSync(ProjectWriteAdmission);
	const state = useSyncExternalStore(owner.subscribeFn, owner.getSnapshotFn, owner.getSnapshotFn);

	useBlocker({
		enableBeforeUnload: false,
		shouldBlockFn: async ({ next }) => {
			if (writeAdmission.isNavigationBlockedFn()) return true;
			const allowed = await owner.requestLeaveFn(next.pathname);
			// A project operation may start while the earlier leave decision is pending.
			return writeAdmission.isNavigationBlockedFn() || !allowed;
		},
	});

	return {
		promptOpen: state.promptOpen,
	};
};
