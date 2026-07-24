import { useAtomValue } from "@effect/atom-react";
import { useLayoutEffect } from "react";
import { AppearanceAtom } from "~/bridge/appearance/AppearanceAtom";

/** Applies the authoritative appearance snapshot at the renderer DOM boundary. */
export const AppearanceDataset = () => {
	const appearance = useAtomValue(AppearanceAtom);

	useLayoutEffect(() => {
		document.documentElement.dataset.theme = appearance.theme;
		document.documentElement.dataset.accent = appearance.accent;
	}, [
		appearance,
	]);

	return null;
};
