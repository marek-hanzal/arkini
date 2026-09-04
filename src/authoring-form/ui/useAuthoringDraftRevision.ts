import { useLayoutEffect, useRef } from "react";

/** Keeps the revision of a dirty draft until its values return to a canonical baseline. */
export const useAuthoringDraftRevision = (revision: number, dirty: boolean) => {
	const draftRevision = useRef(revision);
	useLayoutEffect(() => {
		if (!dirty) draftRevision.current = revision;
	}, [
		dirty,
		revision,
	]);
	return draftRevision;
};
