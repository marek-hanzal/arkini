import { Buffer } from "node:buffer";
import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import type { ProjectPaths } from "../ProjectPaths";
import { EditorBoardScenarioSchema } from "~/board-scenario/EditorBoardScenarioSchema";
import { EditorBoardScenarioFileSchema } from "~/board-scenario/EditorBoardScenarioFileSchema";
import { EditorProjectNoteFileSchema } from "~/project-note/EditorProjectNoteFileSchema";
import { EditorNoteSchema } from "~/project-note/EditorNoteSchema";
import { isFilesystemPathSafeFx } from "~/engine/filesystem/isFilesystemPathSafeFx";

const readJsonFilesFx = Effect.fn("readSidecarJsonFilesFx")(function* (
	root: string,
	directory: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	if (!(yield* fileSystem.exists(directory))) return [];
	const files = (yield* fileSystem.readDirectory(directory))
		.filter((file) => file.endsWith(".json"))
		.sort();
	return yield* Effect.forEach(files, (file) => {
		const target = path.join(directory, file);
		return Effect.gen(function* () {
			if (!(yield* isFilesystemPathSafeFx(fileSystem, root, target)))
				return yield* Effect.fail(
					new Error(`Editor sidecar ${target} must not be a symbolic link.`),
				);
			return yield* fileSystem.readFileString(target).pipe(
				Effect.flatMap((source) =>
					Effect.try({
						try: () => ({
							file: target,
							value: JSON.parse(source) as unknown,
						}),
						catch: (cause) =>
							new Error(`Editor sidecar ${target} is invalid.`, {
								cause,
							}),
					}),
				),
			);
		});
	});
});

/** Loads the portable note and named Board-scenario state captured by open/Refresh. */
export const readSidecarsFx = Effect.fn("readSidecarsFx")(function* ({
	paths,
	projectId,
}: {
	readonly paths: ProjectPaths;
	readonly projectId: string;
}) {
	const path = yield* Path.Path;
	const notes = yield* Effect.forEach(
		yield* readJsonFilesFx(paths.root, paths.notes),
		({ file, value }) =>
			Effect.gen(function* () {
				const noteId = yield* Effect.try({
					try: () => decodeURIComponent(path.basename(file).slice(0, -".json".length)),
					catch: (cause) =>
						new Error(`Editor note ${file} has an invalid filename.`, {
							cause,
						}),
				});
				const note = yield* Effect.try({
					try: () => EditorProjectNoteFileSchema.parse(value),
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
						EditorNoteSchema.parse({
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
	const scenarios = yield* Effect.forEach(
		yield* readJsonFilesFx(paths.root, paths.scenarios),
		({ file, value }) =>
			Effect.gen(function* () {
				const scenario = yield* Effect.try({
					try: () => EditorBoardScenarioFileSchema.parse(value),
					catch: (cause) =>
						new Error(`Editor Board scenario ${file} is invalid.`, {
							cause,
						}),
				});
				const expected = yield* paths.scenarioFileFx(scenario.name);
				if (path.resolve(file) !== expected)
					return yield* Effect.fail(
						new Error(
							`Editor Board scenario ${scenario.name} has an invalid filename.`,
						),
					);
				return yield* Effect.try({
					try: () =>
						EditorBoardScenarioSchema.parse({
							projectId,
							name: scenario.name,
							projectRevision: scenario.revision,
							version: scenario.version,
							bytes: Uint8Array.from(Buffer.from(scenario.save, "base64")),
							createdAtMs: scenario.createdAtMs,
							updatedAtMs: scenario.updatedAtMs,
						}),
					catch: (cause) =>
						new Error(`Editor Board scenario ${scenario.name} is invalid.`, {
							cause,
						}),
				});
			}),
	);
	return {
		notes: notes.sort(
			(left, right) =>
				right.updatedAtMs - left.updatedAtMs || right.noteId.localeCompare(left.noteId),
		),
		scenarios: scenarios.sort(
			(left, right) =>
				right.updatedAtMs - left.updatedAtMs || left.name.localeCompare(right.name),
		),
	};
});
