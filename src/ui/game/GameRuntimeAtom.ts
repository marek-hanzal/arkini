import * as Atom from "effect/unstable/reactivity/Atom";

import type { GameSession } from "~/renderer/game/session/GameSession";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Shares one read-only runtime projection for each exact route-scoped Game. */
export const GameRuntimeAtom = Atom.family(
	(
		committedTransitionAtom: GameSession["committedTransitionAtom"],
	): Atom.Atom<RuntimeSchema.Type> =>
		Atom.readable((get) => get(committedTransitionAtom).runtime),
);
