import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { match } from "ts-pattern";

import type { Game } from "~/renderer/game/Game";
import { makeExactGameAtomFamilyFx } from "~/ui/game/makeExactGameAtomFamilyFx";
import { readExactCauseFailureFn } from "~/application-diagnostics/fn/readExactCauseFailureFn";
import { readRendererLifecycleFx } from "~/application-runtime/lifecycle/readRendererLifecycleFx";
import { RuntimeSaveFx } from "~/game-persistence/RuntimeSaveFx";

export type GameMenuCommand = "save" | "save-and-exit";

/** Owns the one persistence command and result for one exact Game Menu. */
export const gameMenuCommandAtom = Effect.runSync(
	makeExactGameAtomFamilyFx((game: Game) =>
		Atom.fn((command: GameMenuCommand) => {
			const commandFx = match(command)
				.with("save", () =>
					game.runFx(RuntimeSaveFx.pipe(Effect.flatMap((service) => service.flush))),
				)
				.with("save-and-exit", () =>
					readRendererLifecycleFx().pipe(
						Effect.flatMap((lifecycle) => lifecycle.requestCloseFx),
					),
				)
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
							Option.isNone(readExactCauseFailureFn(exit.cause))
						) {
							game.failStop("ui", exit.cause);
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
