import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";
import type { AppearanceAccent } from "~/bridge/appearance/AppearanceAccent";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { AppearanceContext } from "~/ui/appearance/AppearanceContext";

export namespace AppearanceProvider {
	export interface Props extends PropsWithChildren {
		readonly initialTheme?: AppearanceTheme;
		readonly initialAccent?: AppearanceAccent;
	}
}

/** Owns the one renderer appearance snapshot hydrated from desktop preferences. */
export const AppearanceProvider = ({
	children,
	initialTheme = "dark",
	initialAccent = "rose",
}: AppearanceProvider.Props) => {
	const [theme, setTheme] = useState(initialTheme);
	const [accent, setAccent] = useState(initialAccent);

	useEffect(() => {
		document.documentElement.dataset.theme = theme;
	}, [
		theme,
	]);

	useEffect(() => {
		document.documentElement.dataset.accent = accent;
	}, [
		accent,
	]);

	const applyTheme = useCallback((nextTheme: AppearanceTheme) => {
		document.documentElement.dataset.theme = nextTheme;
		setTheme(nextTheme);
	}, []);

	const hydrate = useCallback(
		(preferences: { readonly theme: AppearanceTheme; readonly accent: AppearanceAccent }) => {
			document.documentElement.dataset.theme = preferences.theme;
			document.documentElement.dataset.accent = preferences.accent;
			setTheme(preferences.theme);
			setAccent(preferences.accent);
		},
		[],
	);

	const value = useMemo(
		() => ({
			theme,
			accent,
			applyTheme,
			hydrate,
		}),
		[
			accent,
			applyTheme,
			hydrate,
			theme,
		],
	);

	return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
};
