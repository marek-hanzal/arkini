import { Deferred } from "effect";

/** Process-lifetime readiness completed by the first published cheat preference. */
export const CheatAvailabilityReady = Deferred.makeUnsafe<void>();
