import { useAtomValue } from "@effect/atom-react";
import { useLayoutEffect } from "react";
import { AccentAtom } from "~/application-settings/atom/AccentAtom";

/** Applies the authoritative accent at the renderer DOM boundary. */
export const AccentDataset = () => {
	const accent = useAtomValue(AccentAtom);

	useLayoutEffect(() => {
		document.documentElement.dataset.accent = accent;
	}, [
		accent,
	]);

	return null;
};
