import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { WindowModeSchema } from "../../../electron/contract/window/WindowModeSchema";
import { WindowModeAtom } from "~/window-mode/atom/WindowModeAtom";
import { writeWindowModeFx } from "~/window-mode/fx/writeWindowModeFx";

/** Requests one mode and lets Electron-confirmed events publish the physical result. */
export const setWindowModeAtom = Atom.fn(
	(nextMode: WindowModeSchema.Type) =>
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
