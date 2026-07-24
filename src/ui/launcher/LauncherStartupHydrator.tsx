import { useLayoutEffect, useSyncExternalStore } from "react";
import { useAppearance } from "~/ui/appearance/useAppearance";
import { useCheatAvailability } from "~/ui/cheat-availability/useCheatAvailability";
import { useLauncherStartup } from "~/ui/launcher/useLauncherStartup";

/** Transfers persisted startup preferences to their live owners exactly once. */
export const LauncherStartupHydrator = () => {
	const startup = useLauncherStartup();
	const state = useSyncExternalStore(startup.subscribe, startup.getSnapshot, startup.getSnapshot);
	const { hydrate } = useAppearance();
	const cheatAvailability = useCheatAvailability();

	useLayoutEffect(() => {
		startup.consumeHydration(({ appearance, cheatsAvailable }) => {
			if (appearance !== undefined) hydrate(appearance);
			if (cheatsAvailable !== undefined) cheatAvailability.apply(cheatsAvailable);
		});
	}, [
		cheatAvailability.apply,
		hydrate,
		startup,
		state,
	]);

	return null;
};
