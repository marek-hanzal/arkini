import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import { toDiagnosticValue, writeDiagnosticRecord } from "~/bridge/diagnostics/Diagnostics";
import type { GameSession, GameTransition } from "~/bridge/game/GameSession";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

const readDeliverySummary = (runtime: RuntimeSchema.Type) =>
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

const readTransitionSignature = (transition: GameTransition) =>
	JSON.stringify({
		deliveries: readDeliverySummary(transition.runtime),
		jobs: transition.runtime.jobs.map(({ id, lineId, ownerItemId }) => ({
			id,
			lineId,
			ownerItemId,
		})),
	});

export const installGameDiagnostics = ({
	arkpack,
	restored,
	session,
}: {
	readonly arkpack: ArkpackDescriptor;
	readonly restored: boolean;
	readonly session: GameSession;
}) => {
	const sessionId = crypto.randomUUID();
	let closed = false;
	let latestSequence = 0;
	let previousSignature: string | undefined;

	writeDiagnosticRecord({
		category: [
			"game",
			"session",
		],
		event: "session-started",
		level: "info",
		sessionId,
		data: {
			packageId: arkpack.packageId,
			contentHash: arkpack.hash,
			game: arkpack.game,
			restored,
		},
	});

	const unsubscribeTransitions = session.subscribeTransitions((transition) => {
		try {
			latestSequence = transition.sequence;
			const signature = readTransitionSignature(transition);
			if (signature === previousSignature && transition.events.length === 0) return;
			previousSignature = signature;
			const runtime = transition.runtime;
			writeDiagnosticRecord({
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
					deliveries: readDeliverySummary(runtime),
				},
			});
		} catch (cause) {
			writeDiagnosticRecord({
				category: [
					"renderer",
					"diagnostics",
				],
				event: "transition-record-failed",
				level: "error",
				sessionId,
				data: {
					cause: toDiagnosticValue(cause),
				},
			});
		}
	});
	const unsubscribeFatal = session.subscribeFatalError(() => {
		try {
			const fatal = session.getFatalError();
			writeDiagnosticRecord({
				category: [
					"game",
					"fatal",
				],
				event: "session-failed",
				level: "fatal",
				sessionId,
				data: {
					source: fatal?.source ?? "unknown",
					error: toDiagnosticValue(fatal),
					sequence: latestSequence,
				},
			});
		} catch (cause) {
			writeDiagnosticRecord({
				category: [
					"renderer",
					"diagnostics",
				],
				event: "fatal-record-failed",
				level: "error",
				sessionId,
				data: {
					cause: toDiagnosticValue(cause),
				},
			});
		}
	});

	return {
		sessionId,
		close: (reason: "discarded" | "saved") => {
			if (closed) return;
			closed = true;
			unsubscribeFatal();
			unsubscribeTransitions();
			writeDiagnosticRecord({
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
			});
		},
	};
};
