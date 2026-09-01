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
	switch (section) {
		case "summary":
			return yield* readFileFx(GameIncidentFiles.incident);
		case "failure":
			return yield* readFileFx(GameIncidentFiles.failure);
		case "history":
			return yield* readFileFx(GameIncidentFiles.history);
		case "runtime":
			return yield* readFileFx(GameIncidentFiles.runtimeState);
		case "all":
			return (yield* Effect.all([
				readFileFx(GameIncidentFiles.incident),
				readFileFx(GameIncidentFiles.failure),
				readFileFx(GameIncidentFiles.history),
			])).join("\n\n---\n\n");
	}
});
