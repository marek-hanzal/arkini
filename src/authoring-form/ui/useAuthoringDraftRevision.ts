import { useLayoutEffect, useRef } from "react";

/** TanStack adopts refreshed defaults only while untouched; keep the same revision boundary. */
export const useAuthoringDraftRevision = (revision: number, touched: boolean) => {
	const draftRevision = useRef(revision);
	useLayoutEffect(() => {
		if (!touched) draftRevision.current = revision;
	}, [
		touched,
		revision,
	]);
	return draftRevision;
};
