import { useAtomValue } from "@effect/atom-react";
import { useLayoutEffect, useRef } from "react";

import type { EditorUnsavedChangesSession } from "~/authoring-session/service/EditorUnsavedChanges";
import { EditorUnsavedChangesOwnerAtom } from "~/authoring-session/atom/EditorUnsavedChangesOwnerAtom";

export const useEditorUnsavedChangesOwner = () => {
	const owner = useAtomValue(EditorUnsavedChangesOwnerAtom);
	if (owner === undefined) throw new Error("Editor unsaved-changes owner is not configured.");
	return owner;
};

interface EditorUnsavedChangesRegistrationProps extends EditorUnsavedChangesSession {
	readonly id: string;
}

/** Registers one mounted editor form session with the process-owned leave contract. */
export const useEditorUnsavedChangesRegistration = (
	props: EditorUnsavedChangesRegistrationProps,
) => {
	const owner = useEditorUnsavedChangesOwner();
	const sessionRef = useRef(props);
	sessionRef.current = props;
	useLayoutEffect(
		() =>
			owner.registerFn(props.id, {
				discardFn: () => sessionRef.current.discardFn(),
				isDirtyFn: () => sessionRef.current.isDirtyFn(),
				isValidFn: () => sessionRef.current.isValidFn(),
				ownsPathnameFn: (pathname) => sessionRef.current.ownsPathnameFn(pathname),
				saveFn: () => sessionRef.current.saveFn(),
			}),
		[
			owner,
			props.id,
		],
	);
	useLayoutEffect(() => owner.refreshFn());
};
