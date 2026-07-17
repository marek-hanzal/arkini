import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { writeAppearanceThemeFx } from "~/bridge/appearance/writeAppearanceThemeFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { AppearanceContext } from "~/ui/appearance/AppearanceContext";

export namespace AppearanceProvider {
	export interface Props extends PropsWithChildren {
		readonly initialTheme: AppearanceTheme;
	}
}

/** Owns the selected renderer theme while Electron persists and applies native appearance. */
export const AppearanceProvider = ({ children, initialTheme }: AppearanceProvider.Props) => {
	const [theme, setThemeState] = useState(initialTheme);
	const [switching, setSwitching] = useState(false);

	useEffect(() => {
		document.documentElement.dataset.theme = theme;
	}, [
		theme,
	]);

	const setTheme = useCallback(
		(nextTheme: AppearanceTheme) => {
			if (switching || nextTheme === theme) return;
			const previousTheme = theme;
			setSwitching(true);
			setThemeState(nextTheme);
			void RendererRuntime.runPromise(writeAppearanceThemeFx(nextTheme))
				.catch((error) => {
					setThemeState(previousTheme);
					console.error("Arkini could not persist the appearance theme.", error);
				})
				.finally(() => setSwitching(false));
		},
		[
			switching,
			theme,
		],
	);

	const value = useMemo(
		() => ({
			theme,
			switching,
			setTheme,
		}),
		[
			setTheme,
			switching,
			theme,
		],
	);

	return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
};
