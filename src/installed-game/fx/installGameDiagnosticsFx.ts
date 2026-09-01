import { Effect } from "effect";

import type { DiagnosticRecord } from "~electron/contract/diagnostics/DiagnosticRecord";
import type { ArkpackDescriptor } from "~/arkpack-catalog/type/ArkpackDescriptor";
import { toDiagnosticValueFn } from "~/application-diagnostics/fn/toDiagnosticValueFn";
import { writeDiagnosticRecordFx } from "~/application-diagnostics/fx/writeDiagnosticRecordFx";
import { encodeArkiniSaveFn } from "~/game-persistence/fn/encodeArkiniSaveFn";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import type { GameSession, GameTransition } from "~/game-session/type/GameSession";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { writeLastGameIncidentFx } from "~/installed-game/fx/writeLastGameIncidentFx";

type GameDiagnosticsSession = Pick<
	GameSession,
	| "getFatalErrorFn"
	| "getTransitionSnapshotFn"
	| "subscribeFatalErrorFn"
	| "subscribeTransitionsFn"
>;

export namespace installGameDiagnosticsFx {
	export interface Props {
		readonly arkpack: ArkpackDescriptor;
		readonly arkpackBytes: Uint8Array;
		readonly restored: boolean;
		readonly runRendererEffectFn: <Value>(effect: Effect.Effect<Value, never, never>) => Value;
		readonly session: GameDiagnosticsSession;
	}
}

const GAME_INCIDENT_TRANSITION_HISTORY_LIMIT = 32;
const GAME_DIAGNOSTIC_COLLECTION_LIMIT = 100;

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

const readJobQueueSummaryFn = (runtime: RuntimeSchema.Type) =>
	runtime.jobQueue.map(({ id, lineId, ownerItemId }) => ({
		id,
		lineId,
		ownerItemId,
	}));

const readDefaultLineSummaryFn = (runtime: RuntimeSchema.Type) =>
	Object.entries(runtime.defaultLineByOwnerItemId)
		.sort(([leftOwnerItemId], [rightOwnerItemId]) =>
			leftOwnerItemId.localeCompare(rightOwnerItemId),
		)
		.map(([ownerItemId, lineId]) => ({
			ownerItemId,
			lineId,
		}));

const readTransitionSignatureFn = (transition: GameTransition) =>
	JSON.stringify({
		deliveries: readDeliverySummaryFn(transition.runtime),
		jobs: transition.runtime.jobs.map(({ id, lineId, ownerItemId }) => ({
			id,
			lineId,
			ownerItemId,
		})),
		jobQueue: readJobQueueSummaryFn(transition.runtime),
		defaultLines: readDefaultLineSummaryFn(transition.runtime),
	});

const fatalStateDiagnosticLengthLimit = 14 * 1_024;

const readLastCommittedDiagnosticFn = (transition: GameTransition) =>
	toDiagnosticValueFn(
		{
			sequence: transition.sequence,
			events: transition.events,
			state: fromRuntimeFn({
				runtime: transition.runtime,
			}),
		},
		fatalStateDiagnosticLengthLimit,
	);

export const installGameDiagnosticsFx = Effect.fn("installGameDiagnosticsFx")(function* ({
	arkpack,
	arkpackBytes,
	restored,
	runRendererEffectFn,
	session,
}: installGameDiagnosticsFx.Props) {
	const sessionId = crypto.randomUUID();
	let closed = false;
	let latestSequence = 0;
	let previousSignature: string | undefined;
	const transitionHistory: DiagnosticRecord[] = [];

	const sessionStartedRecord = {
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
	} satisfies DiagnosticRecord;
	yield* writeDiagnosticRecordFx(sessionStartedRecord);

	const unsubscribeTransitionsFn = session.subscribeTransitionsFn((transition) => {
		try {
			latestSequence = transition.sequence;
			const signature = readTransitionSignatureFn(transition);
			if (signature === previousSignature && transition.events.length === 0) return;
			previousSignature = signature;
			const runtime = transition.runtime;
			const jobQueue = readJobQueueSummaryFn(runtime);
			const defaultLines = readDefaultLineSummaryFn(runtime);
			const record = {
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
					jobQueueCount: jobQueue.length,
					jobQueue: jobQueue.slice(0, GAME_DIAGNOSTIC_COLLECTION_LIMIT),
					jobQueueTruncated: jobQueue.length > GAME_DIAGNOSTIC_COLLECTION_LIMIT,
					defaultLines: defaultLines.slice(0, GAME_DIAGNOSTIC_COLLECTION_LIMIT),
					defaultLinesTruncated: defaultLines.length > GAME_DIAGNOSTIC_COLLECTION_LIMIT,
					deliveries: readDeliverySummaryFn(runtime),
				},
			} satisfies DiagnosticRecord;
			transitionHistory.push(record);
			if (transitionHistory.length > GAME_INCIDENT_TRANSITION_HISTORY_LIMIT) {
				transitionHistory.splice(
					0,
					transitionHistory.length - GAME_INCIDENT_TRANSITION_HISTORY_LIMIT,
				);
			}
			runRendererEffectFn(writeDiagnosticRecordFx(record));
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
			const transition = session.getTransitionSnapshotFn();
			const fatalRecord = {
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
					sequence: transition.sequence,
					lastCommitted: readLastCommittedDiagnosticFn(transition),
				},
			} satisfies DiagnosticRecord;
			runRendererEffectFn(
				writeDiagnosticRecordFx(fatalRecord).pipe(
					Effect.andThen(
						writeLastGameIncidentFx({
							arkpackBytes: new Uint8Array(arkpackBytes),
							saveBytes: encodeArkiniSaveFn({
								version: arkpack.version,
								state: fromRuntimeFn({
									runtime: transition.runtime,
								}),
							}),
							diagnostics: [
								sessionStartedRecord,
								...transitionHistory,
								fatalRecord,
							],
						}),
					),
				),
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
