import { useAtomValue } from "@effect/atom-react";
import { CheatAvailabilityAtom } from "~/ui/cheat-availability/CheatAvailabilityAtom";

/** Reads the one live application preference that exposes save-scoped cheat tooling. */
export const useCheatAvailability = () => ({
	available: useAtomValue(CheatAvailabilityAtom),
});
