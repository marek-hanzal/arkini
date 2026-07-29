import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { WindowMode } from "~/bridge/window/WindowMode";
import { WindowModeAtom } from "~/bridge/window/WindowModeAtom";
import { WindowModeReadyAtom } from "~/bridge/window/WindowModeReadyAtom";

/** Publishes one Electron-confirmed native window mode. */
export const applyWindowModeFx = Effect.fn("applyWindowModeFx")((mode: WindowMode) =>
	Effect.uninterruptible(
		Effect.gen(function* () {
			yield* Atom.set(WindowModeAtom, mode);
			yield* Atom.set(WindowModeReadyAtom, true);
		}),
	),
);
