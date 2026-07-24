import { Deferred, Effect } from "effect";
import { CheatAvailabilityReady } from "~/bridge/cheat/CheatAvailabilityReady";

/** Waits until startup has published the persisted cheat preference once. */
export const waitForCheatAvailabilityReadyFx = Effect.fn("waitForCheatAvailabilityReadyFx")(() =>
	Deferred.await(CheatAvailabilityReady),
);
