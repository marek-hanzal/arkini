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
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

import type { ApplicationLogRecordSchema } from "~electron/contract/diagnostics/ApplicationLogRecord";
import type {
	DiagnosticRecord,
	DiagnosticValue,
} from "~electron/contract/diagnostics/DiagnosticRecord";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import { DiagnosticLogFiles } from "~shared/DiagnosticLogMetadata";

/** Process-owned bounded diagnostic log capability exposed to trusted renderer IPC. */
export interface DiagnosticLog {
	readonly directoryPath: string;
	readonly readLastGameFx: Effect.Effect<DiagnosticLog.LastGame | null, unknown, never>;
	readonly snapshotFx: Effect.Effect<readonly DiagnosticLog.File[], unknown, never>;
	readonly writeFx: (record: DiagnosticRecord) => Effect.Effect<void, unknown, never>;
	readonly writeApplicationFx: (
		record: ApplicationLogRecordSchema.Type,
	) => Effect.Effect<void, unknown, never>;
	readonly openDirectoryFx: Effect.Effect<void, unknown, never>;
	readonly closeFx: Effect.Effect<void, unknown, never>;
}

export namespace DiagnosticLog {
	export interface File {
		readonly name: string;
		readonly bytes: Uint8Array;
	}

	export type LastGame =
		| {
				readonly provenance: "official";
				readonly packageId: string;
				readonly contentHash: string;
				readonly version: string;
				readonly serakki: string;
		  }
		| {
				readonly provenance: "community";
		  };
}

const MAX_FILE_BYTES = 5 * 1_024 * 1_024;
const MAX_FILES = 4;
const sensitiveDiagnosticKeys = new Set([
	"authorization",
	"cause",
	"email",
	"error",
	"home",
	"message",
	"path",
	"projectid",
	"root",
	"secret",
	"stack",
	"token",
]);

const LastGameSchema = z.discriminatedUnion("provenance", [
	z
		.object({
			provenance: z.literal("official"),
			packageId: z.string().min(1),
			contentHash: z.string().min(1),
			version: z.string().min(1),
			serakki: z.string().min(1),
		})
		.strict(),
	z
		.object({
			provenance: z.literal("community"),
		})
		.strict(),
]);

const redactDiagnosticValueFn = (value: DiagnosticValue, key?: string): DiagnosticValue => {
	if (key !== undefined && sensitiveDiagnosticKeys.has(key.toLowerCase())) return "<redacted>";
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map((entry) => redactDiagnosticValueFn(entry));
	if (value === null || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value).map(([entryKey, entry]) => [
			entryKey,
			redactDiagnosticValueFn(entry, entryKey),
		]),
	);
};

const sanitizeDiagnosticRecordFn = (record: DiagnosticRecord): DiagnosticRecord => ({
	...record,
	...(record.data === undefined
		? {}
		: {
				data: redactDiagnosticValueFn(record.data) as Readonly<
					Record<string, DiagnosticValue>
				>,
			}),
});

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
		body: record.body === "" ? "" : "Details omitted from support log.",
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

const readLastGameFn = (record: DiagnosticRecord): DiagnosticLog.LastGame | undefined => {
	if (record.event !== "session-started") return undefined;
	if (record.data?.provenance === "community")
		return {
			provenance: "community",
		};
	const candidate = {
		provenance: record.data?.provenance,
		packageId: record.data?.packageId,
		contentHash: record.data?.contentHash,
		version: record.data?.gameVersion,
		serakki: record.data?.serakki,
	};
	const parsed = LastGameSchema.safeParse(candidate);
	return parsed.success ? parsed.data : undefined;
};

export const createDiagnosticLogFx = Effect.fn("createDiagnosticLogFx")((directoryPath: string) =>
	Effect.sync((): DiagnosticLog => {
		mkdirSync(directoryPath, {
			recursive: true,
		});
		const runtimeIdentity = `Serakki v${SerakkiAppVersion} · ${app.isPackaged ? "packaged" : "development"} · ${process.platform} ${process.arch}`;
		configureSync({
			reset: true,
			sinks: {
				application: getRotatingFileSink(
					join(directoryPath, DiagnosticLogFiles.application),
					{
						bufferSize: 0,
						formatter: (record) =>
							formatApplicationLogRecordFn(record, runtimeIdentity),
						maxFiles: MAX_FILES,
						maxSize: MAX_FILE_BYTES,
					},
				),
				diagnostics: getRotatingFileSink(join(directoryPath, DiagnosticLogFiles.session), {
					bufferSize: 0,
					formatter: jsonLinesFormatter,
					maxFiles: MAX_FILES,
					maxSize: MAX_FILE_BYTES,
				}),
			},
			loggers: [
				{
					category: "serakkiApplication",
					lowestLevel: "debug",
					parentSinks: "override",
					sinks: [
						"application",
					],
				},
				{
					category: "serakki",
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
		const logger = getLogger("serakki");
		const applicationLogger = getLogger("serakkiApplication");
		const officialSessions = new Set<string>();
		const lastGamePath = join(directoryPath, DiagnosticLogFiles.lastGame);
		let closed = false;

		return {
			directoryPath,
			writeFx: (record) =>
				Effect.try(() => {
					if (closed) return;
					const lastGame = readLastGameFn(record);
					if (lastGame !== undefined)
						writeFileSync(lastGamePath, `${JSON.stringify(lastGame, null, 2)}\n`);
					if (record.sessionId === undefined) return;
					if (record.event === "session-started") {
						if (record.data?.provenance !== "official") return;
						officialSessions.add(record.sessionId);
					} else if (!officialSessions.has(record.sessionId)) return;
					writeRecordFn(logger, sanitizeDiagnosticRecordFn(record));
					if (record.event === "session-ended" && record.sessionId !== undefined)
						officialSessions.delete(record.sessionId);
				}),
			writeApplicationFx: (record) =>
				Effect.try(() => {
					if (closed) return;
					writeApplicationRecordFn(applicationLogger, record);
				}),
			readLastGameFx: Effect.sync(() => {
				try {
					return LastGameSchema.parse(JSON.parse(readFileSync(lastGamePath, "utf8")));
				} catch {
					return null;
				}
			}),
			snapshotFx: Effect.tryPromise({
				try: async () => {
					const entries = await readdir(directoryPath, {
						withFileTypes: true,
					});
					const names = entries
						.filter(
							(entry) =>
								entry.isFile() &&
								/^(?:support\.md|support\.jsonl)(?:\.\d+)?$/u.test(entry.name),
						)
						.map((entry) => entry.name)
						.sort();
					return Promise.all(
						names.map(async (name) => ({
							name,
							bytes: Uint8Array.from(await readFile(join(directoryPath, name))),
						})),
					);
				},
				catch: (cause) => cause,
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
