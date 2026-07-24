import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { spawnCheatItemAtom } from "~/bridge/cheat/spawnCheatItemAtom";
import type { Game } from "~/bridge/game/Game";
import { makeExactGameAtomFamily } from "~/bridge/game/makeExactGameAtomFamily";
import { readExactCauseFailure } from "~/bridge/game/readExactCauseFailure";

export namespace CheatItemSpawnCommandAtom {
	export type Command =
		| {
				readonly kind: "reset";
		  }
		| {
				readonly kind: "spawn";
				readonly itemId: string;
		  };

	export type State =
		| {
				readonly kind: "idle";
		  }
		| {
				readonly kind: "pending";
		  }
		| {
				readonly kind: "error";
				readonly error: unknown;
		  }
		| {
				readonly kind: "success";
		  };
}

/**
 * Owns synchronous spawn admission and settlement for one mounted exact-Game provider.
 * Reading the runner ties command interruption to the Provider's Atom subscription.
 *
 * TODO(#397): Revalidate stable writable-authority admission and the settlement yield;
 * pending must remain observable and survive the provider remount contract.
 */
export const CheatItemSpawnCommandAtom = makeExactGameAtomFamily((game: Game) => {
	const stateAtom = Atom.make<CheatItemSpawnCommandAtom.State>({
		kind: "idle",
	}).pipe(Atom.setIdleTTL(0));
	const runnerAtom = Atom.fn(
		(itemId: string, get) =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(
					get
						.setResult(spawnCheatItemAtom(game), itemId)
						.pipe(Effect.andThen(Effect.yieldNow)),
				);
				if (Exit.isFailure(exit)) {
					if (Cause.hasInterruptsOnly(exit.cause)) {
						return yield* Effect.failCause(exit.cause);
					}
					const failure = readExactCauseFailure(exit.cause);
					yield* Atom.set(stateAtom, {
						kind: "error",
						error: Option.isSome(failure) ? failure.value : exit.cause,
					});
					return;
				}
				yield* Atom.set(stateAtom, {
					kind: "success",
				});
			}),
		{
			concurrent: true,
		},
	).pipe(Atom.setIdleTTL(0));

	return Atom.writable(
		(get) => {
			get(runnerAtom);
			return get(stateAtom);
		},
		(context, command: CheatItemSpawnCommandAtom.Command) => {
			const state = context.get(stateAtom);
			if (state.kind === "pending") return;
			if (command.kind === "reset") {
				context.set(stateAtom, {
					kind: "idle",
				});
				return;
			}
			context.set(stateAtom, {
				kind: "pending",
			});
			context.set(runnerAtom, command.itemId);
		},
	).pipe(Atom.setIdleTTL(0));
});
