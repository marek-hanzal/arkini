import { getRotatingFileSink } from "@logtape/file";
import {
	configureSync,
	disposeSync,
	getLogger,
	jsonLinesFormatter,
	type Logger,
} from "@logtape/logtape";
import { shell } from "electron";
import { Effect } from "effect";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { DiagnosticRecord } from "~electron/contract/diagnostics/DiagnosticRecord";

/** Process-owned bounded diagnostic log capability exposed to trusted renderer IPC. */
export interface DiagnosticLog {
	readonly directoryPath: string;
	readonly writeFx: (record: DiagnosticRecord) => Effect.Effect<void, unknown>;
	readonly openDirectoryFx: Effect.Effect<void, unknown>;
	readonly closeFx: Effect.Effect<void, unknown>;
}

const MAX_FILE_BYTES = 5 * 1_024 * 1_024;
const MAX_FILES = 4;

const writeRecord = (logger: Logger, record: DiagnosticRecord) => {
	const properties = {
		event: record.event,
		...(record.sessionId === undefined
			? {}
			: {
					sessionId: record.sessionId,
				}),
		...record.data,
	};
	const [category, ...subcategory] = record.category;
	const eventLogger = logger.getChild([
		category,
		...subcategory,
	]);
	switch (record.level) {
		case "debug":
			eventLogger.debug(record.event, properties);
			break;
		case "info":
			eventLogger.info(record.event, properties);
			break;
		case "warning":
			eventLogger.warn(record.event, properties);
			break;
		case "error":
			eventLogger.error(record.event, properties);
			break;
		case "fatal":
			eventLogger.fatal(record.event, properties);
			break;
	}
};

export const createDiagnosticLogFx = Effect.fn("createDiagnosticLogFx")((directoryPath: string) =>
	Effect.sync((): DiagnosticLog => {
		mkdirSync(directoryPath, {
			recursive: true,
		});
		configureSync({
			reset: true,
			sinks: {
				diagnostics: getRotatingFileSink(join(directoryPath, "diagnostics.jsonl"), {
					bufferSize: 0,
					formatter: jsonLinesFormatter,
					maxFiles: MAX_FILES,
					maxSize: MAX_FILE_BYTES,
				}),
			},
			loggers: [
				{
					category: "arkini",
					lowestLevel: "debug",
					parentSinks: "override",
					sinks: [
						"diagnostics",
					],
				},
				{
					category: "logtape",
					lowestLevel: null,
					parentSinks: "override",
					sinks: [],
				},
			],
		});
		const logger = getLogger("arkini");
		let closed = false;

		return {
			directoryPath,
			writeFx: (record) =>
				Effect.try(() => {
					if (closed) return;
					writeRecord(logger, record);
				}),
			openDirectoryFx: Effect.tryPromise({
				try: async () => {
					const error = await shell.openPath(directoryPath);
					if (error !== "") throw new Error(error);
				},
				catch: (cause) => cause,
			}),
			closeFx: Effect.try(() => {
				if (closed) return;
				closed = true;
				disposeSync();
			}),
		};
	}),
);
