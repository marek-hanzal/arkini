import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { applyCheatAvailabilityFx } from "~/bridge/cheat/applyCheatAvailabilityFx";
import { LauncherCheatAvailabilityReadyAtom } from "~/ui/launcher/LauncherCheatAvailabilityReadyAtom";

/** Publishes persisted cheat availability once and completes its Effect readiness gate. */
export const applyLauncherCheatAvailabilityHydrationFx = Effect.fn(
	"applyLauncherCheatAvailabilityHydrationFx",
)((available: boolean) =>
	Effect.uninterruptible(
		Effect.gen(function* () {
			if (yield* Atom.get(LauncherCheatAvailabilityReadyAtom)) return;
			yield* applyCheatAvailabilityFx(available);
			yield* Atom.set(LauncherCheatAvailabilityReadyAtom, true);
		}),
	),
);
