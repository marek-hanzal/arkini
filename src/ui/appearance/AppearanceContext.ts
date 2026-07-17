import { createContext } from "react";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";

export namespace AppearanceContext {
	export interface Value {
		readonly theme: AppearanceTheme;
		readonly switching: boolean;
		readonly setTheme: (theme: AppearanceTheme) => void;
	}
}

export const AppearanceContext = createContext<AppearanceContext.Value | undefined>(undefined);
