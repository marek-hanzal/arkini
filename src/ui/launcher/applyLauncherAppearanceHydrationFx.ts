import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { AppearanceAtom } from "~/ui/appearance/AppearanceAtom";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { LauncherAppearanceReadyAtom } from "~/ui/launcher/LauncherAppearanceReadyAtom";

/** Publishes persisted appearance once without overwriting later user changes on retry. */
export const applyLauncherAppearanceHydrationFx = Effect.fn("applyLauncherAppearanceHydrationFx")(
	(appearance: LauncherStartup.Appearance) =>
		Effect.uninterruptible(
			Effect.gen(function* () {
				if (yield* Atom.get(LauncherAppearanceReadyAtom)) return;
				yield* Atom.set(AppearanceAtom, appearance);
				yield* Atom.set(LauncherAppearanceReadyAtom, true);
			}),
		),
);
