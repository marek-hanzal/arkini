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
			owner.register(props.id, {
				discard: () => sessionRef.current.discard(),
				isDirty: () => sessionRef.current.isDirty(),
				isValid: () => sessionRef.current.isValid(),
				ownsPathname: (pathname) => sessionRef.current.ownsPathname(pathname),
				save: () => sessionRef.current.save(),
			}),
		[
			owner,
			props.id,
		],
	);
	useLayoutEffect(() => owner.refresh());
};
