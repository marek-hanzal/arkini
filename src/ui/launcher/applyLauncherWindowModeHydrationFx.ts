import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { WindowMode } from "~/bridge/window/WindowMode";
import { WindowModeAtom } from "~/bridge/window/WindowModeAtom";
import { WindowModeReadyAtom } from "~/bridge/window/WindowModeReadyAtom";

/** Publishes persisted mode once without overwriting later native window events. */
export const applyLauncherWindowModeHydrationFx = Effect.fn("applyLauncherWindowModeHydrationFx")(
	(mode: WindowMode) =>
		Effect.uninterruptible(
			Effect.gen(function* () {
				if (yield* Atom.get(WindowModeReadyAtom)) return;
				yield* Atom.set(WindowModeAtom, mode);
				yield* Atom.set(WindowModeReadyAtom, true);
			}),
		),
);
