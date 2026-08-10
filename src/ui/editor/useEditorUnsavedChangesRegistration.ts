import { useAtomValue } from "@effect/atom-react";
import { useLayoutEffect, useRef } from "react";

import {
	EditorUnsavedChangesOwnerAtom,
	type EditorUnsavedChangesSession,
} from "~/bridge/editor/EditorUnsavedChanges";

export const useEditorUnsavedChangesOwner = () => {
	const owner = useAtomValue(EditorUnsavedChangesOwnerAtom);
	if (owner === undefined) throw new Error("Editor unsaved-changes owner is not configured.");
	return owner;
};

/** Registers one mounted editor form session with the process-owned leave contract. */
export const useEditorUnsavedChangesRegistration = (
	id: string,
	session: EditorUnsavedChangesSession,
) => {
	const owner = useEditorUnsavedChangesOwner();
	const sessionRef = useRef(session);
	sessionRef.current = session;
	useLayoutEffect(
		() =>
			owner.register(id, {
				discard: () => sessionRef.current.discard(),
				isDirty: () => sessionRef.current.isDirty(),
				isValid: () => sessionRef.current.isValid(),
				ownsPathname: (pathname) => sessionRef.current.ownsPathname(pathname),
				save: () => sessionRef.current.save(),
			}),
		[
			id,
			owner,
		],
	);
	useLayoutEffect(() => owner.refresh());
};
