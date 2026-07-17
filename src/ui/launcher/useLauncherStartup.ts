import { use } from "react";
import { LauncherStartupContext } from "~/ui/launcher/LauncherStartupContext";

/** Reads the one renderer-session launcher startup owner. */
export const useLauncherStartup = () => {
	const startup = use(LauncherStartupContext);
	if (startup === undefined) {
		throw new Error("useLauncherStartup must run beneath LauncherStartupProvider.");
	}
	return startup;
};
