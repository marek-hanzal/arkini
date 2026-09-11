import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import type { ProjectPaths } from "../ProjectPaths";
import { NoteFileSchema } from "~/project-note/schema/NoteFileSchema";
import { NoteSchema } from "~/project-note/schema/NoteSchema";

const decodeNoteFileStemFn = (stem: string) => {
	// URI decoding rejects the lone-surrogate triplets emitted by the total writer.
	const withLoneSurrogates = stem.replace(
		/%ED%([AB][0-9A-F])%([89AB][0-9A-F])/gu,
		(_match, secondByte: string, thirdByte: string) =>
			String.fromCharCode(
				0xd000 |
					((Number.parseInt(secondByte, 16) & 0x3f) << 6) |
					(Number.parseInt(thirdByte, 16) & 0x3f),
			),
	);
	try {
		return decodeURIComponent(withLoneSurrogates);
	} catch {
		return undefined;
	}
};

const readJsonFilesFx = Effect.fn("readNoteJsonFilesFx")(function* (directory: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	if (!(yield* fileSystem.exists(directory))) return [];
	const files = (yield* fileSystem.readDirectory(directory))
		.filter((file) => file.endsWith(".json"))
		.sort();
	return yield* Effect.forEach(files, (file) => {
		const target = path.join(directory, file);
		return Effect.gen(function* () {
			return yield* fileSystem.readFileString(target).pipe(
				Effect.flatMap((source) =>
					Effect.try({
						try: () => ({
							file: target,
							value: JSON.parse(source) as unknown,
						}),
						catch: (cause) =>
							new Error(`Editor Note ${target} is invalid.`, {
								cause,
							}),
					}),
				),
			);
		});
	});
});

/** Loads the portable Notes captured by open/Refresh. */
export const readProjectNotesFx = Effect.fn("readProjectNotesFx")(function* ({
	paths,
	projectId,
}: {
	readonly paths: ProjectPaths;
	readonly projectId: string;
}) {
	const path = yield* Path.Path;
	const noteFiles = yield* readJsonFilesFx(paths.notes);
	const notes = yield* Effect.forEach(noteFiles, ({ file, value }) =>
		Effect.gen(function* () {
			const noteId = decodeNoteFileStemFn(path.basename(file).slice(0, -".json".length));
			if (noteId === undefined)
				return yield* Effect.fail(
					new Error(`Editor note ${file} has an invalid filename.`),
				);
			const note = yield* Effect.try({
				try: () => NoteFileSchema.parse(value),
				catch: (cause) =>
					new Error(`Editor note ${file} is invalid.`, {
						cause,
					}),
			});
			const expected = yield* paths.noteFileFx(noteId);
			if (path.resolve(file) !== expected)
				return yield* Effect.fail(
					new Error(`Editor note ${noteId} has an invalid filename.`),
				);
			return yield* Effect.try({
				try: () =>
					NoteSchema.parse({
						...note,
						noteId,
						projectId,
					}),
				catch: (cause) =>
					new Error(`Editor note ${noteId} is invalid.`, {
						cause,
					}),
			});
		}),
	);
	return notes.sort(
		(left, right) =>
			right.updatedAtMs - left.updatedAtMs || right.noteId.localeCompare(left.noteId),
	);
});
