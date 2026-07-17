import { createContext } from "react";
import type { AppearanceAccent } from "~/bridge/appearance/AppearanceAccent";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";

export namespace AppearanceContext {
	export interface Value {
		readonly theme: AppearanceTheme;
		readonly accent: AppearanceAccent;
		readonly applyTheme: (theme: AppearanceTheme) => void;
		readonly hydrate: (preferences: {
			readonly theme: AppearanceTheme;
			readonly accent: AppearanceAccent;
		}) => void;
	}
}

export const AppearanceContext = createContext<AppearanceContext.Value | undefined>(undefined);
