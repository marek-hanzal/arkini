import { Argument, Command, Flag } from "effect/unstable/cli";
import { Console, Effect, FileSystem, Option } from "effect";
import { join } from "node:path";

interface DiagnosticLine {
	readonly line: string;
	readonly sessionId?: string;
	readonly fatal: boolean;
}

const readDiagnosticLineFn = (line: string): DiagnosticLine | undefined => {
	let value: unknown;
	try {
		value = JSON.parse(line);
	} catch {
		return undefined;
	}
	if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
	const record = value as Record<string, unknown>;
	const properties =
		record.properties !== null &&
		typeof record.properties === "object" &&
		!Array.isArray(record.properties)
			? (record.properties as Record<string, unknown>)
			: undefined;
	const directSessionId = record.sessionId;
	const propertySessionId = properties?.sessionId;
	const sessionId =
		typeof directSessionId === "string"
			? directSessionId
			: typeof propertySessionId === "string"
				? propertySessionId
				: undefined;
	const directEvent = record.event;
	const propertyEvent = properties?.event;
	const message = record.message;
	const event =
		typeof directEvent === "string"
			? directEvent
			: typeof propertyEvent === "string"
				? propertyEvent
				: typeof message === "string"
					? message
					: undefined;
	return {
		line,
		...(sessionId === undefined
			? {}
			: {
					sessionId,
				}),
		fatal: event === "session-failed",
	};
};

const readDiagnosticPathsFx = Effect.fn("readDiagnosticPathsFx")(function* (input: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	const info = yield* fileSystem.stat(input);
	if (info.type === "File")
		return [
			input,
		];
	if (info.type !== "Directory") {
		return yield* Effect.fail(
			new Error(`Diagnostics input is not a file or directory: ${input}`),
		);
	}
	const candidates = (yield* fileSystem.readDirectory(input)).filter((filename) =>
		/^diagnostics\.jsonl(?:\.\d+)?$/.test(filename),
	);
	const dated = yield* Effect.forEach(candidates, (filename) =>
		Effect.map(fileSystem.stat(join(input, filename)), (candidateInfo) => ({
			filename,
			mtime: Option.match(candidateInfo.mtime, {
				onNone: () => 0,
				onSome: (mtime) => mtime.getTime(),
			}),
		})),
	);
	return dated
		.sort(
			(left, right) =>
				left.mtime - right.mtime || left.filename.localeCompare(right.filename),
		)
		.map(({ filename }) => join(input, filename));
});

const runDiagnosticsSliceFx = Effect.fn("runDiagnosticsSliceFx")(function* ({
	input,
	sessionId: requestedSessionId,
}: {
	readonly input: string;
	readonly sessionId: Option.Option<string>;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	const paths = yield* readDiagnosticPathsFx(input);
	const lines = (yield* Effect.forEach(paths, (path) =>
		Effect.map(fileSystem.readFileString(path), (content) =>
			content
				.split(/\r?\n/)
				.filter((line) => line.length > 0)
				.flatMap((line) => {
					const parsed = readDiagnosticLineFn(line);
					return parsed === undefined
						? []
						: [
								parsed,
							];
				}),
		),
	)).flat();
	let sessionId = Option.getOrUndefined(requestedSessionId);
	if (sessionId === undefined) {
		for (let index = lines.length - 1; index >= 0; index -= 1) {
			const line = lines[index];
			if (line?.fatal && line.sessionId !== undefined) {
				sessionId = line.sessionId;
				break;
			}
		}
	}
	if (sessionId === undefined) {
		return yield* Effect.fail(new Error(`No failed game session was found in ${input}.`));
	}
	const sessionLines = lines.filter((line) => line.sessionId === sessionId);
	if (sessionLines.length === 0) {
		return yield* Effect.fail(
			new Error(`Diagnostic session ${sessionId} was not found in ${input}.`),
		);
	}
	for (const line of sessionLines) yield* Console.log(line.line);
});

/** Extracts one exact game session from a diagnostic JSONL file or rotated-log directory. */
export const DiagnosticsSliceCommand = Command.make(
	"slice",
	{
		input: Argument.path("input"),
		sessionId: Flag.optional(
			Flag.string("session-id").pipe(
				Flag.withDescription(
					"Exact diagnostic session ID; defaults to the latest failed session.",
				),
			),
		),
	},
	({ input, sessionId }) =>
		runDiagnosticsSliceFx({
			input,
			sessionId,
		}),
).pipe(
	Command.withDescription(
		"Print one game session from an incident or rotating application diagnostic JSONL set.",
	),
);
