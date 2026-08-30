import { Deferred, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { CheatAvailabilityAtom } from "~/application-settings/atom/CheatAvailabilityAtom";

const cheatAvailabilityReady = Deferred.makeUnsafe<void>();

/** Waits until the initial cheat preference has been published. */
export const awaitCheatAvailabilityFx = Deferred.await(cheatAvailabilityReady);

/** Publishes changed cheat availability and completes initial readiness once. */
export const applyCheatAvailabilityFx = Effect.fn("applyCheatAvailabilityFx")(
	(available: boolean) =>
		Effect.gen(function* () {
			const current = yield* Atom.get(CheatAvailabilityAtom);
			if (current !== available) {
				yield* Atom.set(CheatAvailabilityAtom, available);
			}
			yield* Deferred.succeed(cheatAvailabilityReady, undefined);
		}),
);
