import { match } from "ts-pattern";
import { Effect, FileSystem } from "effect";
import { join } from "node:path";

import { GameIncidentFiles } from "~shared/GameIncidentMetadata";
import type { GameDiagnosticTextSection } from "~/game-incident/type/GameDiagnosticTextSection";

/** Reads one section from the fixed disposable incident text bundle. */
export const readGameIncidentTextFx = Effect.fn("readGameIncidentTextFx")(function* ({
	input,
	section,
}: {
	readonly input: string;
	readonly section: GameDiagnosticTextSection;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	const readFileFx = (filename: string) =>
		fileSystem
			.readFileString(join(input, filename))
			.pipe(Effect.mapError(() => new Error(`Could not read incident file ${filename}.`)));
	return yield* match(section)
		.with("summary", () => readFileFx(GameIncidentFiles.incident))
		.with("failure", () => readFileFx(GameIncidentFiles.failure))
		.with("history", () => readFileFx(GameIncidentFiles.history))
		.with("runtime", () => readFileFx(GameIncidentFiles.runtimeState))
		.with("all", () =>
			Effect.all([
				readFileFx(GameIncidentFiles.incident),
				readFileFx(GameIncidentFiles.failure),
				readFileFx(GameIncidentFiles.history),
			]).pipe(Effect.map((parts) => parts.join("\n\n---\n\n"))),
		)
		.exhaustive();
});
