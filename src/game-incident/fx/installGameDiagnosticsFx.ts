import { TickFx } from "~/game-tick/service/TickFx";
import { Clock, Effect, Exit } from "effect";

import type { DiagnosticRecord } from "~electron/contract/diagnostics/DiagnosticRecord";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import type { SerapackDescriptor } from "~/serapack-catalog/type/SerapackDescriptor";
import {
	toDiagnosticValueFn,
	toDiagnosticValueResultFn,
} from "~/application-diagnostics/fn/toDiagnosticValueFn";
import { writeDiagnosticRecordFx } from "~/application-diagnostics/fx/writeDiagnosticRecordFx";
import { encodeSerakkiSaveFn } from "~/game-persistence/fn/encodeSerakkiSaveFn";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { GAME_DIAGNOSTIC_HISTORY_LIMIT } from "~/game-incident/constant/GameDiagnosticHistoryLimit";
import {
	readGameDiagnosticHistoryEntryFn,
	readGameDiagnosticRelatedItemsResultFn,
	readGameDiagnosticTransitionSignatureFn,
} from "~/game-incident/fn/readGameDiagnosticHistoryEntryFn";
import { readGameDiagnosticRuntimeFn } from "~/game-incident/fn/readGameDiagnosticRuntimeFn";
import type { GameDiagnosticHistoryEntrySchema } from "~/game-incident/schema/GameDiagnosticHistorySchema";
import type { GameDiagnosticFailure } from "~/game-incident/type/GameDiagnosticFailure";
import type { GameIncidentReport } from "~/game-incident/type/GameIncidentReport";
import type { GameSession } from "~/game-session/type/GameSession";
import { writeLastGameIncidentFx } from "~/installed-game/fx/writeLastGameIncidentFx";

type GameDiagnosticsSession = Pick<
	GameSession,
	| "readFn"
	| "getFatalErrorFn"
	| "getTransitionSnapshotFn"
	| "subscribeFatalErrorFn"
	| "subscribeTransitionsFn"
>;

export namespace installGameDiagnosticsFx {
	export type Props = {
		readonly config: GameConfigSchema.Type;
		readonly restored: boolean;
		readonly runRendererEffectFn: <Value>(effect: Effect.Effect<Value, never, never>) => Value;
		readonly session: GameDiagnosticsSession;
	} & (
		| {
				readonly serapack: SerapackDescriptor;
		  }
		| {
				readonly projectId: string;
				readonly projectRevision: number;
		  }
	);
}

const fatalStateDiagnosticLengthLimit = 14 * 1_024;
const fatalErrorDiagnosticLengthLimit = 24 * 1_024;

export const installGameDiagnosticsFx = Effect.fn("installGameDiagnosticsFx")(function* (
	props: installGameDiagnosticsFx.Props,
) {
	const { config, restored, runRendererEffectFn, session } = props;
	const sessionId = crypto.randomUUID();
	const startedAtMs = yield* Clock.currentTimeMillis;
	const startedAt = new Date(startedAtMs).toISOString();
	let closed = false;
	let latestSequence = 0;
	let previousSignature: string | undefined;
	let previousObservedAtMs: number | undefined;
	let totalHistoryEntries = 0;
	const transitionHistory: GameDiagnosticHistoryEntrySchema.Type[] = [];

	const sessionStartedRecord = {
		category: [
			"game",
			"session",
		],
		event: "session-started",
		level: "info",
		sessionId,
		data: {
			applicationVersion: SerakkiAppVersion,
			...("serapack" in props
				? {
						packageId: props.serapack.packageId,
						contentHash: props.serapack.contentHash,
						provenance: props.serapack.provenance.type,
						serakki: props.serapack.serakki,
						gameVersion: props.serapack.version,
					}
				: {
						projectId: props.projectId,
						projectRevision: props.projectRevision,
					}),
			restored,
			startedAt,
		},
	} satisfies DiagnosticRecord;
	yield* writeDiagnosticRecordFx(sessionStartedRecord);

	const tick = session.readFn(TickFx);
	const unsubscribePerformanceFn = Exit.isSuccess(tick)
		? tick.value.subscribePerformanceFn((sample) => {
				if (closed) return;
				runRendererEffectFn(
					writeDiagnosticRecordFx({
						category: [
							"game",
							"performance",
						],
						event: "tick-performance",
						level: "info",
						sessionId,
						data: {
							...sample,
						},
					}),
				);
			})
		: () => undefined;

	const unsubscribeTransitionsFn = session.subscribeTransitionsFn((transition) => {
		try {
			latestSequence = transition.sequence;
			const signature = readGameDiagnosticTransitionSignatureFn(transition);
			if (signature === previousSignature && transition.events.length === 0) return;
			previousSignature = signature;
			const observedAtMs = runRendererEffectFn(Clock.currentTimeMillis);
			const entry = readGameDiagnosticHistoryEntryFn({
				config,
				elapsedSincePreviousMs:
					previousObservedAtMs === undefined
						? null
						: Math.max(0, observedAtMs - previousObservedAtMs),
				observedAt: new Date(observedAtMs).toISOString(),
				transition,
			});
			previousObservedAtMs = observedAtMs;
			totalHistoryEntries += 1;
			const diagnosticEntry = toDiagnosticValueResultFn(entry);
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
					history: diagnosticEntry.value,
					historyTruncated: entry.truncated || diagnosticEntry.truncated,
				},
			} satisfies DiagnosticRecord;
			transitionHistory.push(entry);
			if (transitionHistory.length > GAME_DIAGNOSTIC_HISTORY_LIMIT) {
				transitionHistory.splice(
					0,
					transitionHistory.length - GAME_DIAGNOSTIC_HISTORY_LIMIT,
				);
			}
			runRendererEffectFn(writeDiagnosticRecordFx(record));
			// Per-fact records survive the bounded semantic history's event cap.
			for (const event of transition.events) {
				if (event.type !== "job:aborted" && event.type !== "item:discarded") continue;
				const { type, ...details } = event;
				runRendererEffectFn(
					writeDiagnosticRecordFx({
						category: [
							"game",
							"removal",
						],
						event: type,
						level: "info",
						sessionId,
						data: {
							sequence: transition.sequence,
							...details,
						},
					}),
				);
			}
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
			const observedAtMs = runRendererEffectFn(Clock.currentTimeMillis);
			const observedAt = new Date(observedAtMs).toISOString();
			const error = toDiagnosticValueResultFn(fatal, fatalErrorDiagnosticLengthLimit);
			const relatedItems = readGameDiagnosticRelatedItemsResultFn({
				config,
				transition,
				value: fatal,
			});
			const failure = {
				source: fatal?.source ?? "unknown",
				sequence: transition.sequence,
				observedAt,
				error: error.value,
				errorTruncated: error.truncated,
				relatedItems: relatedItems.items,
				relatedItemsTruncated: relatedItems.truncated,
			} satisfies GameDiagnosticFailure;
			const runtime = readGameDiagnosticRuntimeFn({
				config,
				runtime: transition.runtime,
			});
			const lastCommitted = toDiagnosticValueResultFn(
				{
					sequence: transition.sequence,
					events: transition.events,
					runtime,
				},
				fatalStateDiagnosticLengthLimit,
			);
			const fatalRecord = {
				category: [
					"game",
					"fatal",
				],
				event: "session-failed",
				level: "fatal",
				sessionId,
				data: {
					source: failure.source,
					error: failure.error,
					errorTruncated: failure.errorTruncated,
					sequence: transition.sequence,
					lastCommitted: lastCommitted.value,
					lastCommittedTruncated: lastCommitted.truncated,
					relatedItems: toDiagnosticValueFn(failure.relatedItems),
					relatedItemsTruncated: failure.relatedItemsTruncated,
				},
			} satisfies DiagnosticRecord;
			runRendererEffectFn(writeDiagnosticRecordFx(fatalRecord));
			// Board sessions have project identity and logs, but no installed package to archive.
			if (!("serapack" in props)) return;
			const { serapack } = props;
			const report = {
				capturedAt: observedAt,
				diagnostics: {
					identity: {
						sessionId,
						applicationVersion: SerakkiAppVersion,
						packageId: serapack.packageId,
						contentHash: serapack.contentHash,
						gameVersion: serapack.version,
						serakkiVersion: serapack.serakki,
						restored,
						startedAt,
					},
					history: {
						retainedLimit: GAME_DIAGNOSTIC_HISTORY_LIMIT,
						totalEntries: totalHistoryEntries,
						entries: transitionHistory,
					},
					failure,
					source: {
						fileCount: 0,
						parsedRecords: 0,
						issues: [],
					},
				},
				runtime,
			} satisfies GameIncidentReport;
			runRendererEffectFn(
				writeLastGameIncidentFx({
					serapack,
					saveBytes: encodeSerakkiSaveFn({
						version: serapack.version,
						state: fromRuntimeFn({
							runtime: transition.runtime,
						}),
					}),
					report,
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
			unsubscribePerformanceFn();
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
