import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { spawnCheatItemAtom } from "~/bridge/cheat/spawnCheatItemAtom";
import type { Game } from "~/bridge/game/Game";
import { makeExactGameAtomFamilyFx } from "~/bridge/game/makeExactGameAtomFamilyFx";
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

type SpawnCommand = Extract<
	CheatItemSpawnCommandAtom.Command,
	{
		readonly kind: "spawn";
	}
>;

type AdmittedSpawnCommand = SpawnCommand & {
	readonly generation: number;
};

/**
 * Immediately admits every spawn request for one mounted exact-Game provider.
 *
 * Commands overlap and revalidate against canonical engine state. Presentation
 * retains only the newest request outcome while Provider teardown still
 * interrupts every surviving command.
 */
export const CheatItemSpawnCommandAtom = Effect.runSync(
	makeExactGameAtomFamilyFx((game: Game) => {
		let latestCommandGeneration = 0;
		const stateAtom = Atom.make<CheatItemSpawnCommandAtom.State>({
			kind: "idle",
		}).pipe(Atom.setIdleTTL(0));
		const fatalCauseAtom = Atom.make<Cause.Cause<unknown> | undefined>(undefined).pipe(
			Atom.setIdleTTL(0),
		);
		const runnerAtom = Atom.fn(
			(command: AdmittedSpawnCommand, get) =>
				Effect.gen(function* () {
					const exit = yield* Effect.exit(
						get
							.setResult(spawnCheatItemAtom(game), command.itemId)
							.pipe(Effect.andThen(Effect.yieldNow)),
					);
					if (Exit.isFailure(exit)) {
						if (Cause.hasInterruptsOnly(exit.cause)) {
							return yield* Effect.failCause(exit.cause);
						}
						const failure = readExactCauseFailure(exit.cause);
						if (Option.isNone(failure)) {
							game.failStop("ui", exit.cause);
							yield* Atom.set(fatalCauseAtom, exit.cause);
							return yield* Effect.failCause(exit.cause);
						}
						if (command.generation !== latestCommandGeneration) return;
						yield* Atom.set(stateAtom, {
							kind: "error",
							error: failure.value,
						});
						return;
					}
					if (command.generation !== latestCommandGeneration) return;
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
				const fatalCause = get(fatalCauseAtom);
				if (fatalCause !== undefined) throw fatalCause;
				return get(stateAtom);
			},
			(context, command: CheatItemSpawnCommandAtom.Command) => {
				if (command.kind === "reset") {
					latestCommandGeneration += 1;
					context.set(stateAtom, {
						kind: "idle",
					});
					return;
				}
				const generation = ++latestCommandGeneration;
				context.set(stateAtom, {
					kind: "pending",
				});
				context.set(runnerAtom, {
					...command,
					generation,
				});
			},
		).pipe(Atom.setIdleTTL(0));
	}),
);
