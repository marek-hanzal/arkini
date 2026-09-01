import { Effect, FileSystem, Option } from "effect";
import { join } from "node:path";

import { parseGameDiagnosticLogLineFn } from "~/game-incident/fn/parseGameDiagnosticLogLineFn";
import { readGameDiagnosticSessionFn } from "~/game-incident/fn/readGameDiagnosticSessionFn";
import type { GameDiagnosticLogRecord } from "~/game-incident/type/GameDiagnosticLogRecord";
import type { GameDiagnosticSourceIssue } from "~/game-incident/type/GameDiagnosticSession";

const readDiagnosticLogPathsFx = Effect.fn("readDiagnosticLogPathsFx")(function* (input: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	const info = yield* fileSystem
		.stat(input)
		.pipe(Effect.mapError(() => new Error("Could not inspect the diagnostic input.")));
	if (info.type === "File")
		return [
			input,
		];
	if (info.type !== "Directory") {
		return yield* Effect.fail(new Error("Diagnostic input is not a file or directory."));
	}
	const candidates = (yield* fileSystem
		.readDirectory(input)
		.pipe(
			Effect.mapError(() => new Error("Could not list the diagnostic input directory.")),
		)).filter((filename) => /^diagnostics\.jsonl(?:\.\d+)?$/.test(filename));
	const dated = yield* Effect.forEach(candidates, (filename) =>
		Effect.map(
			fileSystem
				.stat(join(input, filename))
				.pipe(Effect.mapError(() => new Error("Could not inspect a diagnostic log file."))),
			(info) => ({
				filename,
				mtime: Option.match(info.mtime, {
					onNone: () => 0,
					onSome: (mtime) => mtime.getTime(),
				}),
			}),
		),
	);
	const paths = dated
		.sort(
			(left, right) =>
				left.mtime - right.mtime || left.filename.localeCompare(right.filename),
		)
		.map(({ filename }) => join(input, filename));
	if (paths.length === 0) {
		return yield* Effect.fail(
			new Error("No diagnostic JSONL files were found in the diagnostic input."),
		);
	}
	return paths;
});

/** Reads rotating current-format JSONL into one failed diagnostic session. */
export const readGameDiagnosticLogSessionFx = Effect.fn("readGameDiagnosticLogSessionFx")(
	function* ({
		input,
		requestedSessionId,
	}: {
		readonly input: string;
		readonly requestedSessionId: string | undefined;
	}) {
		const fileSystem = yield* FileSystem.FileSystem;
		const paths = yield* readDiagnosticLogPathsFx(input);
		const records: GameDiagnosticLogRecord[] = [];
		const issues: GameDiagnosticSourceIssue[] = [];
		for (const [fileIndex, path] of paths.entries()) {
			const content = yield* fileSystem
				.readFileString(path)
				.pipe(
					Effect.mapError(
						() => new Error(`Could not read diagnostic input file ${fileIndex + 1}.`),
					),
				);
			for (const [lineIndex, source] of content.split(/\r?\n/).entries()) {
				if (source.trim().length === 0) continue;
				const result = parseGameDiagnosticLogLineFn({
					file: fileIndex + 1,
					line: lineIndex + 1,
					source,
				});
				if (result.ok) records.push(result.record);
				else issues.push(result.issue);
			}
		}
		const session = readGameDiagnosticSessionFn({
			fileCount: paths.length,
			issues,
			records,
			requestedSessionId,
		});
		if (session instanceof Error) return yield* Effect.fail(session);
		return session;
	},
);
