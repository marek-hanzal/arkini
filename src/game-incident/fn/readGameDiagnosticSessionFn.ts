import { GAME_DIAGNOSTIC_HISTORY_LIMIT } from "~/game-incident/constant/GameDiagnosticHistoryLimit";
import {
	GameDiagnosticRuntimeCommittedDataSchema,
	GameDiagnosticSessionFailedDataSchema,
	GameDiagnosticSessionStartedDataSchema,
} from "~/game-incident/schema/GameDiagnosticLogRecordSchema";
import type { GameDiagnosticLogRecord } from "~/game-incident/type/GameDiagnosticLogRecord";
import type {
	GameDiagnosticSession,
	GameDiagnosticSourceIssue,
} from "~/game-incident/type/GameDiagnosticSession";

const findLastRecordFn = (
	records: readonly GameDiagnosticLogRecord[],
	predicateFn: (record: GameDiagnosticLogRecord) => boolean,
) => {
	for (let index = records.length - 1; index >= 0; index -= 1) {
		const record = records[index];
		if (record !== undefined && predicateFn(record)) return record;
	}
	return undefined;
};

const invalidSessionRecordErrorFn = (record: GameDiagnosticLogRecord) =>
	new Error(
		`Selected session has an invalid ${record.event} record at input ${record.file}, line ${record.line}.`,
	);

/** Builds one failed session from current, already parsed diagnostic records. */
export const readGameDiagnosticSessionFn = ({
	fileCount,
	issues,
	records,
	requestedSessionId,
}: {
	readonly fileCount: number;
	readonly issues: readonly GameDiagnosticSourceIssue[];
	readonly records: readonly GameDiagnosticLogRecord[];
	readonly requestedSessionId: string | undefined;
}): GameDiagnosticSession | Error => {
	const sessionId =
		requestedSessionId ??
		findLastRecordFn(records, (record) => record.event === "session-failed")?.sessionId ??
		undefined;
	if (sessionId === undefined || sessionId === null) {
		return new Error("No failed game session was found in the diagnostic input.");
	}
	const selected = records.filter((record) => record.sessionId === sessionId);
	if (selected.length === 0) {
		return new Error(`Diagnostic session ${sessionId} was not found in the diagnostic input.`);
	}
	const startedRecord = selected.find((record) => record.event === "session-started");
	if (startedRecord === undefined) {
		return new Error(`Diagnostic session ${sessionId} has no session-started record.`);
	}
	const started = GameDiagnosticSessionStartedDataSchema.safeParse(startedRecord.data);
	if (!started.success) return invalidSessionRecordErrorFn(startedRecord);
	const failedRecord = findLastRecordFn(selected, (record) => record.event === "session-failed");
	if (failedRecord === undefined) {
		return new Error(`Diagnostic session ${sessionId} has no session-failed record.`);
	}
	const failed = GameDiagnosticSessionFailedDataSchema.safeParse(failedRecord.data);
	if (!failed.success) return invalidSessionRecordErrorFn(failedRecord);

	const history = [];
	for (const record of selected) {
		if (record.event !== "runtime-committed") continue;
		const committed = GameDiagnosticRuntimeCommittedDataSchema.safeParse(record.data);
		if (!committed.success) return invalidSessionRecordErrorFn(record);
		history.push({
			...committed.data.history,
			truncated: committed.data.history.truncated || committed.data.historyTruncated,
		});
	}
	return {
		identity: {
			sessionId,
			applicationVersion: started.data.applicationVersion,
			packageId: started.data.packageId,
			contentHash: started.data.contentHash,
			gameVersion: started.data.gameVersion,
			arkiniVersion: started.data.arkini,
			restored: started.data.restored,
			startedAt: started.data.startedAt,
		},
		history: {
			retainedLimit: GAME_DIAGNOSTIC_HISTORY_LIMIT,
			totalEntries: history.length,
			entries: history.slice(-GAME_DIAGNOSTIC_HISTORY_LIMIT),
		},
		failure: {
			source: failed.data.source,
			sequence: failed.data.sequence,
			observedAt: failedRecord.timestamp,
			error: failed.data.error,
			errorTruncated: failed.data.errorTruncated,
			relatedItems: failed.data.relatedItems,
			relatedItemsTruncated: failed.data.relatedItemsTruncated,
		},
		source: {
			fileCount,
			parsedRecords: selected.length,
			issues,
		},
	};
};
