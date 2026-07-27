import { Cause, Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { match } from "ts-pattern";

import { setCheatEnabledAtom } from "~/bridge/cheat/setCheatEnabledAtom";
import { setInstantGameplayAtom } from "~/bridge/cheat/setInstantGameplayAtom";
import type { Game } from "~/bridge/game/Game";
import { makeExactGameAtomFamilyFx } from "~/bridge/game/makeExactGameAtomFamilyFx";
import { settleRendererCommandFailureFx } from "~/bridge/game/settleRendererCommandFailureFx";

type UpdateGameCheatsAction = "cheat-mode" | "instant-gameplay" | "exit";

export namespace updateGameCheatsAtom {
	export type Command =
		| {
				readonly action: "cheat-mode";
				readonly enabled: boolean;
		  }
		| {
				readonly action: "instant-gameplay";
				readonly enabled: boolean;
		  }
		| {
				readonly action: "exit";
				readonly runFx: Effect.Effect<void, unknown>;
		  };

	export type State =
		| {
				readonly kind: "idle";
		  }
		| {
				readonly kind: "pending";
				readonly action: UpdateGameCheatsAction;
		  }
		| {
				readonly kind: "error";
				readonly action: UpdateGameCheatsAction;
				readonly error: unknown;
		  }
		| {
				readonly kind: "saved";
				readonly action: Exclude<UpdateGameCheatsAction, "exit">;
		  };
}

/**
 * Owns synchronous admission, execution and settlement for one exact Game's Cheat screen.
 * Its runner is a read dependency, so leaving the screen interrupts the active Game command.
 *
 * TODO(#397): Revalidate stable writable-authority admission and both settlement yields;
 * the registry remains the sole pending/result truth.
 */
export const updateGameCheatsAtom = Effect.runSync(
	makeExactGameAtomFamilyFx((game: Game) => {
		const stateAtom = Atom.make<updateGameCheatsAtom.State>({
			kind: "idle",
		}).pipe(Atom.setIdleTTL(0));
		const fatalCauseAtom = Atom.make<Cause.Cause<unknown> | undefined>(undefined).pipe(
			Atom.setIdleTTL(0),
		);
		const runnerAtom = Atom.fn(
			(command: updateGameCheatsAtom.Command, get) =>
				Effect.gen(function* () {
					const commandFx = match(command)
						.with(
							{
								action: "cheat-mode",
							},
							({ enabled }) => get.setResult(setCheatEnabledAtom(game), enabled),
						)
						.with(
							{
								action: "instant-gameplay",
							},
							({ enabled }) => get.setResult(setInstantGameplayAtom(game), enabled),
						)
						.with(
							{
								action: "exit",
							},
							({ runFx }) => runFx.pipe(Effect.andThen(Effect.yieldNow)),
						)
						.exhaustive();
					const exit = yield* Effect.exit(
						commandFx.pipe(Effect.andThen(Effect.yieldNow)),
					);
					if (Exit.isFailure(exit)) {
						return yield* settleRendererCommandFailureFx({
							cause: exit.cause,
							game,
							onFailure: (failure) =>
								Atom.set(stateAtom, {
									kind: "error",
									action: command.action,
									error: failure,
								}),
							setFatalCause: (cause) => Atom.set(fatalCauseAtom, cause),
						});
					}
					yield* Atom.set(
						stateAtom,
						command.action === "exit"
							? {
									kind: "idle",
								}
							: {
									kind: "saved",
									action: command.action,
								},
					);
				}),
			{
				concurrent: true,
			},
		).pipe(Atom.setIdleTTL(0));

		return Atom.writable(
			(get) => {
				get(runnerAtom);
				const fatalCause = get(fatalCauseAtom);
				if (fatalCause !== undefined) throw fatalCause;
				return get(stateAtom);
			},
			(context, command: updateGameCheatsAtom.Command) => {
				if (context.get(stateAtom).kind === "pending") return;
				context.set(stateAtom, {
					kind: "pending",
					action: command.action,
				});
				context.set(runnerAtom, command);
			},
		).pipe(Atom.setIdleTTL(0));
	}),
);
