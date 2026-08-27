import { Effect, FileSystem } from "effect";
import { basename, dirname, join } from "node:path";

import { createFilesystemWriteFx } from "~/engine/filesystem/createFilesystemWriteFx";
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
	function* (fileSystem: FileSystem.FileSystem, target: string) {
		if (!(yield* fileSystem.exists(target))) return false;
		const canonical = join(yield* fileSystem.realPath(dirname(target)), basename(target));
		if (
			(yield* fileSystem.realPath(target)) !== canonical ||
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
