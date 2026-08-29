import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { WindowModeSchema } from "../../../electron/contract/window/WindowModeSchema";
import { WindowModeAtom } from "~/renderer/window/WindowModeAtom";
import { WindowModeReadyAtom } from "~/renderer/window/WindowModeReadyAtom";

/** Publishes persisted mode once without overwriting later native window events. */
export const applyLauncherWindowModeHydrationFx = Effect.fn("applyLauncherWindowModeHydrationFx")(
	(mode: WindowModeSchema.Type) =>
		Effect.uninterruptible(
			Effect.gen(function* () {
				if (yield* Atom.get(WindowModeReadyAtom)) return;
				yield* Atom.set(WindowModeAtom, mode);
				yield* Atom.set(WindowModeReadyAtom, true);
			}),
		),
);
