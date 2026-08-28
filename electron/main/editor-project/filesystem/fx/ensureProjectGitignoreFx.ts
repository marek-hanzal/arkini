import { Effect, FileSystem } from "effect";

import { createFilesystemWriteFx } from "~/engine/filesystem/createFilesystemWriteFx";
import type { EditorProjectFilesystemPaths } from "../EditorProjectFilesystemPaths";
import { addGitignoreRulesFx } from "./addGitignoreRulesFx";
import { assertProjectFileFx } from "./assertProjectFileFx";

const encoder = new TextEncoder();

/** Preserves the user file while ensuring the one derived project-build exclusion. */
export const ensureProjectGitignoreFx = Effect.fn("ensureProjectGitignoreFx")(function* (
	paths: EditorProjectFilesystemPaths,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const filesystemWrite = yield* createFilesystemWriteFx();
	yield* filesystemWrite.withLockFx(
		paths.lockFile,
		Effect.gen(function* () {
			const exists = yield* assertProjectFileFx(fileSystem, paths.root, paths.gitignoreFile);
			const source = exists ? yield* fileSystem.readFileString(paths.gitignoreFile) : "";
			const next = yield* addGitignoreRulesFx(source);
			if (next === source) return;
			yield* filesystemWrite.writeFileFx({
				lock: paths.lockFile,
				target: paths.gitignoreFile,
				bytes: encoder.encode(next),
			});
		}),
	);
});
