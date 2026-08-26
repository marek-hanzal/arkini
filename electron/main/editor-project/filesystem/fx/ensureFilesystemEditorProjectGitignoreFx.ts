import { FileSystem } from "effect";
import { Effect } from "effect";

import type { EditorProjectFilesystemPaths } from "../EditorProjectFilesystemPaths";
import { replaceFilesystemEditorFileFx } from "./replaceFilesystemEditorFileFx";

const buildRules = new Set([
	"/build/",
	"/build",
	"build/",
	"build",
]);

/** Preserves the user file while ensuring the one derived project-build exclusion. */
export const ensureFilesystemEditorProjectGitignoreFx = Effect.fn(
	"ensureFilesystemEditorProjectGitignoreFx",
)(function* (paths: EditorProjectFilesystemPaths) {
	const fileSystem = yield* FileSystem.FileSystem;
	const source = (yield* fileSystem.exists(paths.gitignoreFile))
		? yield* fileSystem.readFileString(paths.gitignoreFile)
		: "";
	if (source.split(/\r?\n/).some((line) => buildRules.has(line.trim()))) return;
	const next = `${source}${source.length === 0 || source.endsWith("\n") ? "" : "\n"}/build/\n`;
	yield* replaceFilesystemEditorFileFx({
		target: paths.gitignoreFile,
		bytes: new TextEncoder().encode(next),
	});
});
