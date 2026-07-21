import { use, useSyncExternalStore } from "react";
import { CheatAvailabilityContext } from "~/ui/cheat-availability/CheatAvailabilityContext";

/** Reads the one live application preference that exposes save-scoped cheat tooling. */
export const useCheatAvailability = () => {
	const availability = use(CheatAvailabilityContext);
	if (availability === undefined) {
		throw new Error("CheatAvailabilityProvider is missing.");
	}
	const available = useSyncExternalStore(
		availability.subscribe,
		availability.getSnapshot,
		availability.getSnapshot,
	);
	return {
		available,
		apply: availability.apply,
	};
};
