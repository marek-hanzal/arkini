import type { PropsWithChildren } from "react";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { LauncherStartupContext } from "~/ui/launcher/LauncherStartupContext";

export namespace LauncherStartupProvider {
	export interface Props extends PropsWithChildren {
		readonly startup: LauncherStartup;
	}
}

/** Exposes the one renderer-session startup owner to launcher routes. */
export const LauncherStartupProvider = ({ startup, children }: LauncherStartupProvider.Props) => (
	<LauncherStartupContext.Provider value={startup}>{children}</LauncherStartupContext.Provider>
);
