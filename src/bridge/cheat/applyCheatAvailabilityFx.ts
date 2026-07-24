import { Deferred, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { CheatAvailabilityAtom } from "~/bridge/cheat/CheatAvailabilityAtom";
import { CheatAvailabilityReady } from "~/bridge/cheat/CheatAvailabilityReady";

/** Publishes changed cheat availability and completes initial readiness once. */
export const applyCheatAvailabilityFx = Effect.fn("applyCheatAvailabilityFx")(
	(available: boolean) =>
		Effect.gen(function* () {
			const current = yield* Atom.get(CheatAvailabilityAtom);
			if (current !== available) {
				yield* Atom.set(CheatAvailabilityAtom, available);
			}
			yield* Deferred.succeed(CheatAvailabilityReady, undefined);
		}),
);
