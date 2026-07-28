import { Cause, Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/bridge/game/makeExactGameAtomFamilyFx";
import { settleRendererCommandFailureFx } from "~/bridge/game/settleRendererCommandFailureFx";
import { toDiagnosticValue, writeDiagnosticRecord } from "~/bridge/diagnostics/Diagnostics";
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
		const fatalCauseAtom = Atom.make<Cause.Cause<unknown> | undefined>(undefined).pipe(
			Atom.setIdleTTL(0),
		);
		const runnerAtom = Atom.fn(
			(command: AdmittedStartCommand) =>
				Effect.gen(function* () {
					const exit = yield* Effect.exit(
						game.runFx(
							Effect.gen(function* () {
								const autofill = yield* autofillLineInputsFx({
									lineId: command.lineId,
									ownerItemId: command.ownerItemId,
									purpose: {
										kind: "fill-and-try-start",
										lineId: command.lineId,
										ownerItemId: command.ownerItemId,
										source: "player",
									},
								});
								const autofilled = autofill.scheduledQuantity > 0;
								if (autofilled) {
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
						writeDiagnosticRecord({
							category: [
								"game",
								"command",
							],
							event: "default-line-command-failed",
							level: "error",
							sessionId: game.diagnosticSessionId,
							data: {
								generation: command.generation,
								lineId: command.lineId,
								ownerItemId: command.ownerItemId,
								cause: toDiagnosticValue(exit.cause),
							},
						});
						return yield* settleRendererCommandFailureFx({
							cause: exit.cause,
							game,
							onFailure: (failure) =>
								command.generation !== latestCommandGeneration
									? Effect.void
									: Atom.set(stateAtom, {
											kind: "error",
											autofilled: false,
											error: failure,
											ownerItemId: command.ownerItemId,
										}),
							setFatalCause: (cause) => Atom.set(fatalCauseAtom, cause),
						});
					}
					if (exit.value.startExit !== null && Exit.isFailure(exit.value.startExit)) {
						writeDiagnosticRecord({
							category: [
								"game",
								"command",
							],
							event: "default-line-start-rejected",
							level: "warning",
							sessionId: game.diagnosticSessionId,
							data: {
								autofilled: exit.value.autofilled,
								generation: command.generation,
								lineId: command.lineId,
								ownerItemId: command.ownerItemId,
								cause: toDiagnosticValue(exit.value.startExit.cause),
							},
						});
						return yield* settleRendererCommandFailureFx({
							cause: exit.value.startExit.cause,
							game,
							onFailure: (failure) =>
								command.generation !== latestCommandGeneration
									? Effect.void
									: Atom.set(stateAtom, {
											kind: "error",
											autofilled: exit.value.autofilled,
											error: failure,
											ownerItemId: command.ownerItemId,
										}),
							setFatalCause: (cause) => Atom.set(fatalCauseAtom, cause),
						});
					}
					writeDiagnosticRecord({
						category: [
							"game",
							"command",
						],
						event: "default-line-command-succeeded",
						level: "info",
						sessionId: game.diagnosticSessionId,
						data: {
							autofilled: exit.value.autofilled,
							generation: command.generation,
							lineId: command.lineId,
							ownerItemId: command.ownerItemId,
						},
					});
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
				const fatalCause = get(fatalCauseAtom);
				if (fatalCause !== undefined) throw fatalCause;
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
				writeDiagnosticRecord({
					category: [
						"game",
						"command",
					],
					event: "default-line-command-admitted",
					level: "info",
					sessionId: game.diagnosticSessionId,
					data: {
						generation,
						lineId: command.lineId,
						ownerItemId: command.ownerItemId,
					},
				});
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
