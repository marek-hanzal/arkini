import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { match } from "ts-pattern";

import type { Game } from "~/bridge/game/Game";
import { makeExactGameAtomFamily } from "~/bridge/game/makeExactGameAtomFamily";
import { requestApplicationCloseFx } from "~/bridge/lifecycle/requestApplicationCloseFx";
import { RuntimeSaveFx } from "~/bridge/save/RuntimeSaveFx";

export type GameMenuCommand = "save" | "save-and-exit";

/** Owns the one persistence command and result for one exact Game Menu. */
export const gameMenuCommandAtom = makeExactGameAtomFamily((game: Game) =>
	Atom.fn((command: GameMenuCommand) => {
		const commandFx = match(command)
			.with("save", () =>
				game.runFx(RuntimeSaveFx.pipe(Effect.flatMap((service) => service.flush))),
			)
			.with("save-and-exit", () => requestApplicationCloseFx())
			.exhaustive();

		return commandFx.pipe(
			Effect.exit,
			Effect.map((exit) => ({
				command,
				exit,
			})),
		);
	}).pipe(Atom.setIdleTTL(0)),
);
