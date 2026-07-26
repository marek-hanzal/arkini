import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/bridge/game/makeExactGameAtomFamilyFx";
import { readExactCauseFailure } from "~/bridge/game/readExactCauseFailure";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { autofillLineInputsFx } from "~/engine/input/write/autofillLineInputsFx";
import { startLineFx } from "~/engine/job/write/startLineFx";

export namespace TileDefaultLineCommandAtom {
	export type Command =
		| {
				readonly kind: "reset";
		  }
		| {
				readonly kind: "start";
				readonly lineId: string;
				readonly ownerItemId: string;
		  };

	export type State =
		| {
				readonly kind: "idle";
		  }
		| {
				readonly kind: "pending";
				readonly ownerItemId: string;
		  }
		| {
				readonly kind: "error";
				readonly autofilled: boolean;
				readonly error: unknown;
				readonly ownerItemId: string;
		  };
}

type StartCommand = Extract<
	TileDefaultLineCommandAtom.Command,
	{
		readonly kind: "start";
	}
>;

type AdmittedStartCommand = StartCommand & {
	readonly generation: number;
	readonly key: string;
};

const readStartCommandKey = (command: StartCommand) =>
	JSON.stringify([
		command.ownerItemId,
		command.lineId,
	]);

/**
 * Immediately admits independent primary-line clicks for the mounted Pixi game surface.
 *
 * Repeated clicks for the same owner and line coalesce while their engine
 * command is unsettled. Different owners or lines still overlap and revalidate
 * against canonical engine state without a presentation-wide lock.
 */
export const TileDefaultLineCommandAtom = RendererRuntime.runSync(
	makeExactGameAtomFamilyFx((game) => {
		const activeCommandKeys = new Set<string>();
		let latestCommandGeneration = 0;
		const stateAtom = Atom.make<TileDefaultLineCommandAtom.State>({
			kind: "idle",
		}).pipe(Atom.setIdleTTL(0));
		const runnerAtom = Atom.fn(
			(command: AdmittedStartCommand) =>
				Effect.gen(function* () {
					const exit = yield* Effect.exit(
						game.runFx(
							Effect.gen(function* () {
								const autofill = yield* autofillLineInputsFx({
									lineId: command.lineId,
									ownerItemId: command.ownerItemId,
								});
								const autofilled = autofill.storedQuantity > 0;
								if (autofilled && autofill.remainingMissingQuantity > 0) {
									return {
										autofilled,
										startExit: null,
									} as const;
								}
								return {
									autofilled,
									startExit: yield* Effect.exit(
										startLineFx({
											lineId: command.lineId,
											ownerItemId: command.ownerItemId,
										}),
									),
								} as const;
							}),
						),
					);
					if (Exit.isFailure(exit)) {
						if (Cause.hasInterruptsOnly(exit.cause)) {
							return yield* Effect.failCause(exit.cause);
						}
						if (command.generation !== latestCommandGeneration) return;
						const failure = readExactCauseFailure(exit.cause);
						yield* Atom.set(stateAtom, {
							kind: "error",
							autofilled: false,
							error: Option.isSome(failure) ? failure.value : exit.cause,
							ownerItemId: command.ownerItemId,
						});
						return;
					}
					if (exit.value.startExit !== null && Exit.isFailure(exit.value.startExit)) {
						if (Cause.hasInterruptsOnly(exit.value.startExit.cause)) {
							return yield* Effect.failCause(exit.value.startExit.cause);
						}
						if (command.generation !== latestCommandGeneration) return;
						const failure = readExactCauseFailure(exit.value.startExit.cause);
						yield* Atom.set(stateAtom, {
							kind: "error",
							autofilled: exit.value.autofilled,
							error: Option.isSome(failure)
								? failure.value
								: exit.value.startExit.cause,
							ownerItemId: command.ownerItemId,
						});
						return;
					}
					if (command.generation !== latestCommandGeneration) return;
					yield* Atom.set(stateAtom, {
						kind: "idle",
					});
				}).pipe(
					Effect.ensuring(
						Effect.sync(() => {
							activeCommandKeys.delete(command.key);
						}),
					),
				),
			{
				concurrent: true,
			},
		).pipe(Atom.setIdleTTL(0));

		return Atom.writable(
			(get) => {
				get(runnerAtom);
				return get(stateAtom);
			},
			(context, command: TileDefaultLineCommandAtom.Command) => {
				if (command.kind === "reset") {
					if (context.get(stateAtom).kind !== "error") return;
					context.set(stateAtom, {
						kind: "idle",
					});
					return;
				}
				const key = readStartCommandKey(command);
				if (activeCommandKeys.has(key)) return;
				const state = context.get(stateAtom);
				if (state.kind === "error" && state.ownerItemId === command.ownerItemId) return;
				activeCommandKeys.add(key);
				const generation = ++latestCommandGeneration;
				context.set(stateAtom, {
					kind: "pending",
					ownerItemId: command.ownerItemId,
				});
				context.set(runnerAtom, {
					...command,
					generation,
					key,
				});
			},
		).pipe(Atom.setIdleTTL(0));
	}),
);
