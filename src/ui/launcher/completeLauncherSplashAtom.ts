import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { RendererAtomRuntime } from "~/renderer/RendererAtomRegistry";
import { LauncherSplashCompletedAtom } from "~/ui/launcher/LauncherSplashCompletedAtom";

/** Marks the startup splash complete idempotently through the shared registry. */
export const completeLauncherSplashAtom = RendererAtomRuntime.fn((_input: void) =>
	Effect.gen(function* () {
		if (yield* Atom.get(LauncherSplashCompletedAtom)) return;
		yield* Atom.set(LauncherSplashCompletedAtom, true);
	}),
);
