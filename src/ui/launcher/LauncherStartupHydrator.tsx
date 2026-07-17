import { useEffect, useSyncExternalStore } from "react";
import { useAppearance } from "~/ui/appearance/useAppearance";
import { useLauncherStartup } from "~/ui/launcher/useLauncherStartup";

/** Applies persisted startup appearance before the splash becomes visible where possible. */
export const LauncherStartupHydrator = () => {
	const startup = useLauncherStartup();
	const state = useSyncExternalStore(startup.subscribe, startup.getSnapshot, startup.getSnapshot);
	const { hydrate } = useAppearance();

	useEffect(() => {
		if (state.appearance !== null) hydrate(state.appearance);
	}, [
		hydrate,
		state.appearance,
	]);

	return null;
};
