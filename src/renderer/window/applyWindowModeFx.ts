import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { WindowModeSchema } from "../../../electron/contract/window/WindowModeSchema";
import { WindowModeAtom } from "~/renderer/window/WindowModeAtom";
import { WindowModeReadyAtom } from "~/renderer/window/WindowModeReadyAtom";

/** Publishes one Electron-confirmed native window mode. */
export const applyWindowModeFx = Effect.fn("applyWindowModeFx")((mode: WindowModeSchema.Type) =>
	Effect.uninterruptible(
		Effect.gen(function* () {
			yield* Atom.set(WindowModeAtom, mode);
			yield* Atom.set(WindowModeReadyAtom, true);
		}),
	),
);
