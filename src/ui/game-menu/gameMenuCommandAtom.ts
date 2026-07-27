import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { match } from "ts-pattern";

import type { Game } from "~/bridge/game/Game";
import { makeExactGameAtomFamilyFx } from "~/bridge/game/makeExactGameAtomFamilyFx";
import { readExactCauseFailure } from "~/bridge/game/readExactCauseFailure";
import { requestApplicationCloseFx } from "~/bridge/lifecycle/requestApplicationCloseFx";
import { RuntimeSaveFx } from "~/bridge/save/RuntimeSaveFx";

export type GameMenuCommand = "save" | "save-and-exit";

/** Owns the one persistence command and result for one exact Game Menu. */
export const gameMenuCommandAtom = Effect.runSync(
	makeExactGameAtomFamilyFx((game: Game) =>
		Atom.fn((command: GameMenuCommand) => {
			const commandFx = match(command)
				.with("save", () =>
					game.runFx(RuntimeSaveFx.pipe(Effect.flatMap((service) => service.flush))),
				)
				.with("save-and-exit", () => requestApplicationCloseFx())
				.exhaustive();

			return commandFx.pipe(
				Effect.exit,
				Effect.flatMap((exit) => {
					if (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)) {
						return Effect.failCause(exit.cause);
					}
					if (Exit.isFailure(exit) && Option.isNone(readExactCauseFailure(exit.cause))) {
						game.failStop("ui", exit.cause);
						return Effect.failCause(exit.cause);
					}
					return Effect.succeed({
						command,
						exit,
					});
				}),
			);
		}).pipe(Atom.setIdleTTL(0)),
	),
);
