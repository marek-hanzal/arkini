import { getRotatingFileSink } from "@logtape/file";
import {
	configureSync,
	disposeSync,
	getLogger,
	jsonLinesFormatter,
	type LogRecord,
	type Logger,
} from "@logtape/logtape";
import { app, shell } from "electron";
import { Effect } from "effect";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { ApplicationLogRecordSchema } from "~electron/contract/diagnostics/ApplicationLogRecord";
import type { DiagnosticRecord } from "~electron/contract/diagnostics/DiagnosticRecord";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";

/** Process-owned bounded diagnostic log capability exposed to trusted renderer IPC. */
export interface DiagnosticLog {
	readonly directoryPath: string;
	readonly writeFx: (record: DiagnosticRecord) => Effect.Effect<void, unknown, never>;
	readonly writeApplicationFx: (
		record: ApplicationLogRecordSchema.Type,
	) => Effect.Effect<void, unknown, never>;
	readonly openDirectoryFx: Effect.Effect<void, unknown, never>;
	readonly closeFx: Effect.Effect<void, unknown, never>;
}

const MAX_FILE_BYTES = 5 * 1_024 * 1_024;
const MAX_FILES = 4;

const formatApplicationLogRecordFn = (record: LogRecord, runtimeIdentity: string): string => {
	const message =
		typeof record.rawMessage === "string" ? record.rawMessage : record.message.join("");
	const body = typeof record.properties.body === "string" ? record.properties.body.trim() : "";
	return `# ${new Date(record.timestamp).toISOString()} [${String(record.level).toUpperCase()}] - ${message}\n\n${runtimeIdentity}\n\n${body}${body === "" ? "" : "\n"}\n`;
};

const writeRecordFn = (logger: Logger, record: DiagnosticRecord) => {
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

const writeApplicationRecordFn = (logger: Logger, record: ApplicationLogRecordSchema.Type) => {
	const properties = {
		body: record.body,
	};
	switch (record.level) {
		case "debug":
			logger.debug(record.message, properties);
			break;
		case "info":
			logger.info(record.message, properties);
			break;
		case "warning":
			logger.warn(record.message, properties);
			break;
		case "error":
			logger.error(record.message, properties);
			break;
		case "fatal":
			logger.fatal(record.message, properties);
			break;
	}
};

export const createDiagnosticLogFx = Effect.fn("createDiagnosticLogFx")((directoryPath: string) =>
	Effect.sync((): DiagnosticLog => {
		mkdirSync(directoryPath, {
			recursive: true,
		});
		const runtimeIdentity = `Arkini v${ArkiniAppVersion} · ${app.isPackaged ? "packaged" : "development"} · ${process.platform} ${process.arch}`;
		configureSync({
			reset: true,
			sinks: {
				application: getRotatingFileSink(join(directoryPath, "application.md"), {
					bufferSize: 0,
					formatter: (record) => formatApplicationLogRecordFn(record, runtimeIdentity),
					maxFiles: MAX_FILES,
					maxSize: MAX_FILE_BYTES,
				}),
				diagnostics: getRotatingFileSink(join(directoryPath, "diagnostics.jsonl"), {
					bufferSize: 0,
					formatter: jsonLinesFormatter,
					maxFiles: MAX_FILES,
					maxSize: MAX_FILE_BYTES,
				}),
			},
			loggers: [
				{
					category: "arkiniApplication",
					lowestLevel: "debug",
					parentSinks: "override",
					sinks: [
						"application",
					],
				},
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
		const applicationLogger = getLogger("arkiniApplication");
		let closed = false;

		return {
			directoryPath,
			writeFx: (record) =>
				Effect.try(() => {
					if (closed) return;
					writeRecordFn(logger, record);
				}),
			writeApplicationFx: (record) =>
				Effect.try(() => {
					if (closed) return;
					writeApplicationRecordFn(applicationLogger, record);
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
