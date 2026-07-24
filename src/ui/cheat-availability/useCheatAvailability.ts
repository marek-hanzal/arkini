import { useAtomValue } from "@effect/atom-react";
import { CheatAvailabilityAtom } from "~/bridge/cheat/CheatAvailabilityAtom";

/** Reads the one live application preference that exposes save-scoped cheat tooling. */
export const useCheatAvailability = () => ({
	available: useAtomValue(CheatAvailabilityAtom),
});
