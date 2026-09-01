import { Clock, Effect } from "effect";

import type { DiagnosticRecord } from "~electron/contract/diagnostics/DiagnosticRecord";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import type { ArkpackDescriptor } from "~/arkpack-catalog/type/ArkpackDescriptor";
import {
	toDiagnosticValueFn,
	toDiagnosticValueResultFn,
} from "~/application-diagnostics/fn/toDiagnosticValueFn";
import { writeDiagnosticRecordFx } from "~/application-diagnostics/fx/writeDiagnosticRecordFx";
import { encodeArkiniSaveFn } from "~/game-persistence/fn/encodeArkiniSaveFn";
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
	| "getFatalErrorFn"
	| "getTransitionSnapshotFn"
	| "subscribeFatalErrorFn"
	| "subscribeTransitionsFn"
>;

export namespace installGameDiagnosticsFx {
	export interface Props {
		readonly arkpack: ArkpackDescriptor;
		readonly arkpackBytes: Uint8Array;
		readonly config: GameConfigSchema.Type;
		readonly restored: boolean;
		readonly runRendererEffectFn: <Value>(effect: Effect.Effect<Value, never, never>) => Value;
		readonly session: GameDiagnosticsSession;
	}
}

const fatalStateDiagnosticLengthLimit = 14 * 1_024;
const fatalErrorDiagnosticLengthLimit = 24 * 1_024;

export const installGameDiagnosticsFx = Effect.fn("installGameDiagnosticsFx")(function* ({
	arkpack,
	arkpackBytes,
	config,
	restored,
	runRendererEffectFn,
	session,
}: installGameDiagnosticsFx.Props) {
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
			applicationVersion: ArkiniAppVersion,
			packageId: arkpack.packageId,
			contentHash: arkpack.contentHash,
			arkini: arkpack.arkini,
			gameVersion: arkpack.version,
			restored,
			startedAt,
		},
	} satisfies DiagnosticRecord;
	yield* writeDiagnosticRecordFx(sessionStartedRecord);

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
			const report = {
				capturedAt: observedAt,
				diagnostics: {
					identity: {
						sessionId,
						applicationVersion: ArkiniAppVersion,
						packageId: arkpack.packageId,
						contentHash: arkpack.contentHash,
						gameVersion: arkpack.version,
						arkiniVersion: arkpack.arkini,
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
							report,
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
