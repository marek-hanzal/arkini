import { GameDiagnosticLogRecordSchema } from "~/game-incident/schema/GameDiagnosticLogRecordSchema";
import type { GameDiagnosticLogLineResult } from "~/game-incident/type/GameDiagnosticLogRecord";

/** Parses exactly the current LogTape JSON-lines contract without compatibility guesses. */
export const parseGameDiagnosticLogLineFn = ({
	file,
	line,
	source,
}: {
	readonly file: number;
	readonly line: number;
	readonly source: string;
}): GameDiagnosticLogLineResult => {
	let value: unknown;
	try {
		value = JSON.parse(source);
	} catch {
		return {
			ok: false,
			issue: {
				file,
				line,
				message: "invalid JSON",
			},
		};
	}
	const parsed = GameDiagnosticLogRecordSchema.safeParse(value);
	if (!parsed.success) {
		return {
			ok: false,
			issue: {
				file,
				line,
				message: "record does not match the current diagnostic log contract",
			},
		};
	}
	const { event, sessionId, ...data } = parsed.data.properties;
	if (typeof event !== "string" || event.length === 0 || event !== parsed.data.message) {
		return {
			ok: false,
			issue: {
				file,
				line,
				message: "record has no exact diagnostic event identity",
			},
		};
	}
	if (sessionId !== undefined && (typeof sessionId !== "string" || sessionId.length === 0)) {
		return {
			ok: false,
			issue: {
				file,
				line,
				message: "record has an invalid session identity",
			},
		};
	}
	return {
		ok: true,
		record: {
			file,
			line,
			timestamp: parsed.data["@timestamp"],
			event,
			sessionId: sessionId ?? null,
			data,
		},
	};
};
