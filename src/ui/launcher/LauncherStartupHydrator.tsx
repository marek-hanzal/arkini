import { useAtomValue } from "@effect/atom-react";
import { LauncherStartupAtom } from "~/ui/launcher/LauncherStartupAtom";

/** Mounts the one keep-alive launcher bootstrap at the renderer root. */
export const LauncherStartupHydrator = () => {
	useAtomValue(LauncherStartupAtom);

	return null;
};
