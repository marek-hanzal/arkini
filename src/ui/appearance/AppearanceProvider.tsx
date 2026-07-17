import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";
import type { AppearanceAccent } from "~/bridge/appearance/AppearanceAccent";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { writeAppearanceAccentFx } from "~/bridge/appearance/writeAppearanceAccentFx";
import { writeAppearanceThemeFx } from "~/bridge/appearance/writeAppearanceThemeFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { AppearanceContext } from "~/ui/appearance/AppearanceContext";

export namespace AppearanceProvider {
	export interface Props extends PropsWithChildren {
		readonly initialTheme?: AppearanceTheme;
		readonly initialAccent?: AppearanceAccent;
	}
}

/** Owns renderer appearance while Electron persists theme and accent preferences. */
export const AppearanceProvider = ({
	children,
	initialTheme = "dark",
	initialAccent = "rose",
}: AppearanceProvider.Props) => {
	const [theme, setThemeState] = useState(initialTheme);
	const [accent, setAccentState] = useState(initialAccent);
	const [switchingTheme, setSwitchingTheme] = useState(false);
	const [switchingAccent, setSwitchingAccent] = useState(false);

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

	const hydrate = useCallback(
		(preferences: { readonly theme: AppearanceTheme; readonly accent: AppearanceAccent }) => {
			document.documentElement.dataset.theme = preferences.theme;
			document.documentElement.dataset.accent = preferences.accent;
			setThemeState(preferences.theme);
			setAccentState(preferences.accent);
		},
		[],
	);

	const setTheme = useCallback(
		(nextTheme: AppearanceTheme) => {
			if (switchingTheme || nextTheme === theme) return;
			const previousTheme = theme;
			setSwitchingTheme(true);
			setThemeState(nextTheme);
			void RendererRuntime.runPromise(writeAppearanceThemeFx(nextTheme))
				.catch((error) => {
					setThemeState(previousTheme);
					console.error("Arkini could not persist the appearance theme.", error);
				})
				.finally(() => setSwitchingTheme(false));
		},
		[
			switchingTheme,
			theme,
		],
	);

	const setAccent = useCallback(
		(nextAccent: AppearanceAccent) => {
			if (switchingAccent || nextAccent === accent) return;
			const previousAccent = accent;
			setSwitchingAccent(true);
			setAccentState(nextAccent);
			void RendererRuntime.runPromise(writeAppearanceAccentFx(nextAccent))
				.catch((error) => {
					setAccentState(previousAccent);
					console.error("Arkini could not persist the appearance accent.", error);
				})
				.finally(() => setSwitchingAccent(false));
		},
		[
			accent,
			switchingAccent,
		],
	);

	const value = useMemo(
		() => ({
			theme,
			accent,
			switching: switchingTheme || switchingAccent,
			setTheme,
			setAccent,
			hydrate,
		}),
		[
			accent,
			hydrate,
			setAccent,
			setTheme,
			switchingAccent,
			switchingTheme,
			theme,
		],
	);

	return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
};
