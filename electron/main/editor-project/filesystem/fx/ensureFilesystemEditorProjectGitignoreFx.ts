import { Effect, FileSystem } from "effect";

import { createFilesystemWriteFx } from "~/engine/filesystem/createFilesystemWriteFx";
import { isFilesystemPathSafeFx } from "~/engine/filesystem/isFilesystemPathSafeFx";
import type { EditorProjectFilesystemPaths } from "../EditorProjectFilesystemPaths";

const encoder = new TextEncoder();
const rules = [
	{
		line: "/build/",
		variants: new Set([
			"/build/",
			"/build",
			"build/",
			"build",
		]),
	},
	{
		line: "/editor.lock",
		variants: new Set([
			"/editor.lock",
			"editor.lock",
		]),
	},
] as const;

export const addFilesystemEditorProjectGitignoreRules = (source: string) => {
	const lines = source.split(/\r?\n/).map((line) => line.trim());
	const missing = rules.filter(({ variants }) => !lines.some((line) => variants.has(line)));
	if (missing.length === 0) return source;
	return `${source}${source.length === 0 || source.endsWith("\n") ? "" : "\n"}${missing.map(({ line }) => line).join("\n")}\n`;
};

export const assertFilesystemEditorProjectFileFx = Effect.fn("assertFilesystemEditorProjectFileFx")(
	function* (fileSystem: FileSystem.FileSystem, root: string, target: string) {
		if (!(yield* fileSystem.exists(target))) return false;
		if (
			!(yield* isFilesystemPathSafeFx(fileSystem, root, target)) ||
			(yield* fileSystem.stat(target)).type !== "File"
		)
			return yield* Effect.fail(
				new Error(`Editor project file ${target} must not be a symbolic link.`),
			);
		return true;
	},
);

/** Preserves the user file while ensuring the one derived project-build exclusion. */
export const ensureFilesystemEditorProjectGitignoreFx = Effect.fn(
	"ensureFilesystemEditorProjectGitignoreFx",
)(function* (paths: EditorProjectFilesystemPaths) {
	const fileSystem = yield* FileSystem.FileSystem;
	const filesystemWrite = yield* createFilesystemWriteFx();
	yield* filesystemWrite.withLockFx(
		paths.lockFile,
		Effect.gen(function* () {
			const exists = yield* assertFilesystemEditorProjectFileFx(
				fileSystem,
				paths.root,
				paths.gitignoreFile,
			);
			const source = exists ? yield* fileSystem.readFileString(paths.gitignoreFile) : "";
			const next = addFilesystemEditorProjectGitignoreRules(source);
			if (next === source) return;
			yield* filesystemWrite.writeFileFx({
				lock: paths.lockFile,
				target: paths.gitignoreFile,
				bytes: encoder.encode(next),
			});
		}),
	);
});
