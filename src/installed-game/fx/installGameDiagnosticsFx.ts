import { Effect } from "effect";

import type { ArkpackDescriptor } from "~/arkpack-catalog/type/ArkpackDescriptor";
import { toDiagnosticValueFn } from "~/application-diagnostics/fn/toDiagnosticValueFn";
import { writeDiagnosticRecordFx } from "~/application-diagnostics/fx/writeDiagnosticRecordFx";
import type { GameSession, GameTransition } from "~/game-session/type/GameSession";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

type GameDiagnosticsSession = Pick<
	GameSession,
	"getFatalErrorFn" | "subscribeFatalErrorFn" | "subscribeTransitionsFn"
>;

export namespace installGameDiagnosticsFx {
	export interface Props {
		readonly arkpack: ArkpackDescriptor;
		readonly restored: boolean;
		readonly runRendererEffectFn: <Value>(effect: Effect.Effect<Value, never, never>) => Value;
		readonly session: GameDiagnosticsSession;
	}
}

const readDeliverySummaryFn = (runtime: RuntimeSchema.Type) =>
	runtime.items.flatMap((item) => {
		const location = item.location;
		if (location.scope !== "delivery") return [];
		return [
			{
				itemId: item.id,
				itemDefinitionId: item.item.id,
				quantity: item.quantity,
				generation: location.generation,
				phase: location.phase,
				origin: location.origin,
				...(location.phase === "outbound"
					? {
							target: location.target,
						}
					: {
							returnFrom: location.returnFrom,
						}),
			},
		];
	});

const readTransitionSignatureFn = (transition: GameTransition) =>
	JSON.stringify({
		deliveries: readDeliverySummaryFn(transition.runtime),
		jobs: transition.runtime.jobs.map(({ id, lineId, ownerItemId }) => ({
			id,
			lineId,
			ownerItemId,
		})),
	});

export const installGameDiagnosticsFx = Effect.fn("installGameDiagnosticsFx")(function* ({
	arkpack,
	restored,
	runRendererEffectFn,
	session,
}: installGameDiagnosticsFx.Props) {
	const sessionId = crypto.randomUUID();
	let closed = false;
	let latestSequence = 0;
	let previousSignature: string | undefined;

	yield* writeDiagnosticRecordFx({
		category: [
			"game",
			"session",
		],
		event: "session-started",
		level: "info",
		sessionId,
		data: {
			packageId: arkpack.packageId,
			contentHash: arkpack.contentHash,
			arkini: arkpack.arkini,
			restored,
		},
	});

	const unsubscribeTransitionsFn = session.subscribeTransitionsFn((transition) => {
		try {
			latestSequence = transition.sequence;
			const signature = readTransitionSignatureFn(transition);
			if (signature === previousSignature && transition.events.length === 0) return;
			previousSignature = signature;
			const runtime = transition.runtime;
			runRendererEffectFn(
				writeDiagnosticRecordFx({
					category: [
						"game",
						"transition",
					],
					event: "runtime-committed",
					level: "info",
					sessionId,
					data: {
						sequence: transition.sequence,
						eventTypes: transition.events.map((event) => event.type),
						itemCount: runtime.items.length,
						jobCount: runtime.jobs.length,
						jobQueueCount: runtime.jobQueue.length ?? 0,
						deliveries: readDeliverySummaryFn(runtime),
					},
				}),
			);
		} catch (cause) {
			runRendererEffectFn(
				writeDiagnosticRecordFx({
					category: [
						"renderer",
						"diagnostics",
					],
					event: "transition-record-failed",
					level: "error",
					sessionId,
					data: {
						cause: toDiagnosticValueFn(cause),
					},
				}),
			);
		}
	});
	const unsubscribeFatalFn = session.subscribeFatalErrorFn(() => {
		try {
			const fatal = session.getFatalErrorFn();
			runRendererEffectFn(
				writeDiagnosticRecordFx({
					category: [
						"game",
						"fatal",
					],
					event: "session-failed",
					level: "fatal",
					sessionId,
					data: {
						source: fatal?.source ?? "unknown",
						error: toDiagnosticValueFn(fatal),
						sequence: latestSequence,
					},
				}),
			);
		} catch (cause) {
			runRendererEffectFn(
				writeDiagnosticRecordFx({
					category: [
						"renderer",
						"diagnostics",
					],
					event: "fatal-record-failed",
					level: "error",
					sessionId,
					data: {
						cause: toDiagnosticValueFn(cause),
					},
				}),
			);
		}
	});

	return {
		sessionId,
		close: (reason: "discarded" | "saved") => {
			if (closed) return;
			closed = true;
			unsubscribeFatalFn();
			unsubscribeTransitionsFn();
			runRendererEffectFn(
				writeDiagnosticRecordFx({
					category: [
						"game",
						"session",
					],
					event: "session-ended",
					level: "info",
					sessionId,
					data: {
						reason,
						sequence: latestSequence,
					},
				}),
			);
		},
	};
});
