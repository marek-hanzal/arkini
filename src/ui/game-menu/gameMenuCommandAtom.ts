import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { match } from "ts-pattern";

import type { PackageGameEngine } from "~/bridge/game/GameEngine";
import { makeExactGameAtomFamilyFx } from "~/bridge/game/makeExactGameAtomFamilyFx";
import { readExactCauseFailureFx } from "~/bridge/game/readExactCauseFailureFx";
import { requestApplicationCloseFx } from "~/bridge/lifecycle/requestApplicationCloseFx";

export type GameMenuCommand = "save" | "save-and-exit";

/** Owns the one persistence command and result for one exact Game Menu. */
export const gameMenuCommandAtom = Effect.runSync(
	makeExactGameAtomFamilyFx((game: PackageGameEngine) =>
		Atom.fn((command: GameMenuCommand) => {
			const commandFx = match(command)
				.with("save", () => game.saveFx)
				.with("save-and-exit", () => requestApplicationCloseFx())
				.exhaustive();

			return commandFx.pipe(
				Effect.exit,
				Effect.flatMap((exit) =>
					Effect.gen(function* () {
						if (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)) {
							return yield* Effect.failCause(exit.cause);
						}
						if (
							Exit.isFailure(exit) &&
							Option.isNone(yield* readExactCauseFailureFx(exit.cause))
						) {
							game.reportCriticalFailure("game-runtime", exit.cause);
							return yield* Effect.failCause(exit.cause);
						}
						return {
							command,
							exit,
						};
					}),
				),
			);
		}).pipe(Atom.setIdleTTL(0)),
	),
);
