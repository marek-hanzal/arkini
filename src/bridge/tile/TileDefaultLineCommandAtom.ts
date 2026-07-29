import { Cause, Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/bridge/game/makeExactGameAtomFamilyFx";
import { settleRendererCommandFailureFx } from "~/bridge/game/settleRendererCommandFailureFx";
import { toDiagnosticValue, writeDiagnosticRecord } from "~/bridge/diagnostics/Diagnostics";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { enqueueLineFx } from "~/engine/job/write/enqueueLineFx";

export namespace TileDefaultLineCommandAtom {
	export type Command =
		| {
				readonly kind: "reset";
		  }
		| {
				readonly kind: "enqueue";
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
				readonly error: unknown;
				readonly ownerItemId: string;
		  };
}

type EnqueueCommand = Extract<
	TileDefaultLineCommandAtom.Command,
	{
		readonly kind: "enqueue";
	}
>;

type AdmittedEnqueueCommand = EnqueueCommand & {
	readonly generation: number;
	readonly key: string;
};

const readEnqueueCommandKey = (command: EnqueueCommand) =>
	JSON.stringify([
		command.ownerItemId,
		command.lineId,
	]);

/**
 * Immediately admits independent default-line Enqueue clicks for the mounted Pixi game surface.
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
			(command: AdmittedEnqueueCommand) =>
				Effect.gen(function* () {
					const exit = yield* Effect.exit(
						game.runFx(
							Effect.gen(function* () {
								const enqueueExit = yield* Effect.exit(
									enqueueLineFx({
										lineId: command.lineId,
										ownerItemId: command.ownerItemId,
									}),
								);
								return {
									enqueueExit,
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
											error: failure,
											ownerItemId: command.ownerItemId,
										}),
							setFatalCause: (cause) => Atom.set(fatalCauseAtom, cause),
						});
					}
					if (Exit.isFailure(exit.value.enqueueExit)) {
						writeDiagnosticRecord({
							category: [
								"game",
								"command",
							],
							event: "default-line-enqueue-rejected",
							level: "warning",
							sessionId: game.diagnosticSessionId,
							data: {
								generation: command.generation,
								lineId: command.lineId,
								ownerItemId: command.ownerItemId,
								cause: toDiagnosticValue(exit.value.enqueueExit.cause),
							},
						});
						return yield* settleRendererCommandFailureFx({
							cause: exit.value.enqueueExit.cause,
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
					writeDiagnosticRecord({
						category: [
							"game",
							"command",
						],
						event: "default-line-enqueue-succeeded",
						level: "info",
						sessionId: game.diagnosticSessionId,
						data: {
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
				const key = readEnqueueCommandKey(command);
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
					event: "default-line-enqueue-admitted",
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
