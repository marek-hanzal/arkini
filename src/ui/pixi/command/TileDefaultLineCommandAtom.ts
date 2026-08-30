import { Cause, Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/ui/game/makeExactGameAtomFamilyFx";
import { settleRendererCommandFailureFx } from "~/ui/game/settleRendererCommandFailureFx";
import { toDiagnosticValueFn } from "~/application-diagnostics/fn/toDiagnosticValueFn";
import { writeDiagnosticRecordFx } from "~/application-diagnostics/fx/writeDiagnosticRecordFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { enqueueDefaultLineFx } from "~/production-job/write/enqueueDefaultLineFx";
import { fillDefaultLineQueueFx } from "~/production-job/write/fillDefaultLineQueueFx";

export namespace TileDefaultLineCommandAtom {
	export type Command =
		| {
				readonly kind: "reset";
		  }
		| {
				readonly kind: "enqueue";
				readonly ownerItemId: string;
		  }
		| {
				readonly kind: "fill";
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
				readonly error: unknown;
				readonly ownerItemId: string;
		  };
}

type QueueCommand = Extract<
	TileDefaultLineCommandAtom.Command,
	{
		readonly ownerItemId: string;
	}
>;

type AdmittedQueueCommand = QueueCommand & {
	readonly generation: number;
	readonly key: string;
};

const readQueueCommandKey = (command: QueueCommand) => command.ownerItemId;

/**
 * Immediately admits independent default-line queue actions for the mounted Pixi game surface.
 *
 * Repeated actions for the same owner coalesce while their engine command is
 * unsettled. Different owners still overlap and revalidate
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
			(command: AdmittedQueueCommand) =>
				Effect.gen(function* () {
					const exit = yield* Effect.exit(
						game.runFx(
							Effect.gen(function* () {
								const commandExit = yield* Effect.exit(
									Effect.gen(function* () {
										if (command.kind === "enqueue") {
											return {
												kind: command.kind,
												result: yield* enqueueDefaultLineFx({
													ownerItemId: command.ownerItemId,
												}),
											} as const;
										}
										return {
											kind: command.kind,
											result: yield* fillDefaultLineQueueFx({
												ownerItemId: command.ownerItemId,
											}),
										} as const;
									}),
								);
								return {
									commandExit,
								} as const;
							}),
						),
					);
					if (Exit.isFailure(exit)) {
						yield* writeDiagnosticRecordFx({
							category: [
								"game",
								"command",
							],
							event: "default-line-command-failed",
							level: "error",
							sessionId: game.diagnosticSessionId,
							data: {
								action: command.kind,
								generation: command.generation,
								ownerItemId: command.ownerItemId,
								cause: toDiagnosticValueFn(exit.cause),
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
											error: failure,
											ownerItemId: command.ownerItemId,
										}),
							setFatalCause: (cause) => Atom.set(fatalCauseAtom, cause),
						});
					}
					if (Exit.isFailure(exit.value.commandExit)) {
						yield* writeDiagnosticRecordFx({
							category: [
								"game",
								"command",
							],
							event: "default-line-queue-rejected",
							level: "warning",
							sessionId: game.diagnosticSessionId,
							data: {
								action: command.kind,
								generation: command.generation,
								ownerItemId: command.ownerItemId,
								cause: toDiagnosticValueFn(exit.value.commandExit.cause),
							},
						});
						return yield* settleRendererCommandFailureFx({
							cause: exit.value.commandExit.cause,
							game,
							onFailure: (failure) =>
								command.generation !== latestCommandGeneration
									? Effect.void
									: Atom.set(stateAtom, {
											kind: "error",
											error: failure,
											ownerItemId: command.ownerItemId,
										}),
							setFatalCause: (cause) => Atom.set(fatalCauseAtom, cause),
						});
					}
					yield* writeDiagnosticRecordFx({
						category: [
							"game",
							"command",
						],
						event: "default-line-queue-succeeded",
						level: "info",
						sessionId: game.diagnosticSessionId,
						data: {
							action: command.kind,
							generation: command.generation,
							ownerItemId: command.ownerItemId,
							result: toDiagnosticValueFn(exit.value.commandExit.value),
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
				const key = readQueueCommandKey(command);
				if (activeCommandKeys.has(key)) return;
				const state = context.get(stateAtom);
				if (state.kind === "error" && state.ownerItemId === command.ownerItemId) return;
				activeCommandKeys.add(key);
				const generation = ++latestCommandGeneration;
				RendererRuntime.runSync(
					writeDiagnosticRecordFx({
						category: [
							"game",
							"command",
						],
						event: "default-line-queue-admitted",
						level: "info",
						sessionId: game.diagnosticSessionId,
						data: {
							action: command.kind,
							generation,
							ownerItemId: command.ownerItemId,
						},
					}),
				);
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
