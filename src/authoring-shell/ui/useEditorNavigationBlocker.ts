import { useBlocker } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";

import { useEditorUnsavedChangesOwner } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";

export namespace useEditorNavigationBlocker {
	export interface Output {
		readonly promptOpen: boolean;
	}
}

/** Admits navigation only after every dirty Editor session accepts its destination. */
export const useEditorNavigationBlocker = (): useEditorNavigationBlocker.Output => {
	const owner = useEditorUnsavedChangesOwner();
	const state = useSyncExternalStore(owner.subscribeFn, owner.getSnapshotFn, owner.getSnapshotFn);

	useBlocker({
		disabled: !state.hasDirtySession,
		enableBeforeUnload: false,
		shouldBlockFn: async ({ next }) => !(await owner.requestLeaveFn(next.pathname)),
	});

	return {
		promptOpen: state.promptOpen,
	};
};
