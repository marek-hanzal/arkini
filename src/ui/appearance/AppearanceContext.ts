import { createContext } from "react";
import type { AppearanceAccent } from "~/bridge/appearance/AppearanceAccent";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";

export namespace AppearanceContext {
	export interface Value {
		readonly theme: AppearanceTheme;
		readonly accent: AppearanceAccent;
		readonly switching: boolean;
		readonly setTheme: (theme: AppearanceTheme) => void;
		readonly setAccent: (accent: AppearanceAccent) => void;
		readonly hydrate: (preferences: {
			readonly theme: AppearanceTheme;
			readonly accent: AppearanceAccent;
		}) => void;
	}
}

export const AppearanceContext = createContext<AppearanceContext.Value | undefined>(undefined);
