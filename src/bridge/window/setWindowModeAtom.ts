import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { WindowMode } from "~/bridge/window/WindowMode";
import { WindowModeAtom } from "~/bridge/window/WindowModeAtom";
import { writeWindowModeFx } from "~/bridge/window/writeWindowModeFx";

/** Requests one mode and lets Electron-confirmed events publish the physical result. */
export const setWindowModeAtom = Atom.fn(
	(nextMode: WindowMode) =>
		Effect.gen(function* () {
			if ((yield* Atom.get(WindowModeAtom)) === nextMode) {
				yield* Effect.yieldNow;
				return;
			}
			yield* writeWindowModeFx(nextMode);
		}),
	{
		concurrent: true,
	},
).pipe(Atom.setIdleTTL(0));
