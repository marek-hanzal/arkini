import { randomUUID } from "node:crypto";
import { FileSystem, Path } from "effect";
import { Effect, Exit } from "effect";

import { syncFilesystemPathFx } from "../filesystem/syncFilesystemPathFx";
import { createEditorProjectFilesystemPathsFx } from "./filesystem/createEditorProjectFilesystemPathsFx";
import { readFilesystemEditorProjectFilesFx } from "./filesystem/fx/readFilesystemEditorProjectFilesFx";
import { readFilesystemEditorProjectSidecarsFx } from "./filesystem/fx/readFilesystemEditorProjectSidecarsFx";
import { readFilesystemEditorProjectVersionHistoryFx } from "./filesystem/fx/readFilesystemEditorProjectVersionHistoryFx";
import { EditorJsonExportOwnershipFile } from "./EditorJsonExportRecoveryRecord";
import { recoverOneEditorJsonExportFx } from "./recoverEditorJsonExportsFx";

const writeSyncedTextFx = (target: string, source: string) =>
	Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		yield* fileSystem.writeFileString(target, source, {
			flag: "wx",
			mode: 0o600,
		});
		yield* syncFilesystemPathFx(fileSystem, target);
		yield* syncFilesystemPathFx(fileSystem, path.dirname(target));
	});

const syncExportTreeFx = Effect.fn("syncEditorJsonExportTreeFx")(function* (
	root: string,
	files: ReadonlyArray<string>,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const directories = [
		root,
	];
	for (const file of files) {
		const target = path.join(root, file);
		const info = yield* fileSystem.stat(target);
		if ((yield* fileSystem.realPath(target)) !== target)
			return yield* Effect.fail(new Error(`Editor export entry ${file} is not canonical.`));
		if (info.type === "File") yield* syncFilesystemPathFx(fileSystem, target);
		else if (info.type === "Directory") directories.push(target);
		else return yield* Effect.fail(new Error(`Editor export entry ${file} is not portable.`));
	}
	for (const directory of directories.sort((left, right) => right.length - left.length))
		yield* syncFilesystemPathFx(fileSystem, directory);
});

export namespace replaceEditorJsonExportDirectoryFx {
	export interface Props {
		readonly recoveryRoot: string;
		readonly source: string;
		readonly target: string;
	}

	export interface Success {
		readonly json: number;
		readonly resources: number;
		readonly revision: number;
	}
}

/** Validates and journal-publishes one complete portable Editor project directory. */
export const replaceEditorJsonExportDirectoryFx = Effect.fn("replaceEditorJsonExportDirectoryFx")(
	function* ({ recoveryRoot, source, target }: replaceEditorJsonExportDirectoryFx.Props) {
		const fileSystem = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const transaction = randomUUID();
		const parent = path.dirname(target);
		const name = path.basename(target);
		const pending = path.join(parent, `.${name}.${transaction}.pending`);
		const previous = path.join(parent, `.${name}.${transaction}.previous`);
		const recoveryDirectory = path.join(recoveryRoot, transaction);

		return yield* Effect.gen(function* () {
			yield* fileSystem.copy(source, pending, {
				overwrite: true,
				preserveTimestamps: true,
			});
			const copiedFiles = yield* fileSystem.readDirectory(pending, {
				recursive: true,
			});
			const excluded = (file: string) =>
				file === "editor.lock" ||
				file === "build" ||
				file.startsWith("build/") ||
				file.endsWith(".tmp");
			for (const file of copiedFiles) {
				if (excluded(file))
					yield* fileSystem.remove(path.join(pending, file), {
						force: true,
						recursive: true,
					});
			}
			const paths = yield* createEditorProjectFilesystemPathsFx(pending);
			const project = yield* readFilesystemEditorProjectFilesFx(pending);
			yield* readFilesystemEditorProjectSidecarsFx({
				paths,
				projectId: project.config.meta.id,
			});
			yield* readFilesystemEditorProjectVersionHistoryFx(paths);
			const exportedFiles = yield* fileSystem.readDirectory(pending, {
				recursive: true,
			});
			yield* syncExportTreeFx(pending, exportedFiles);
			yield* writeSyncedTextFx(
				path.join(pending, EditorJsonExportOwnershipFile),
				transaction,
			);
			yield* syncFilesystemPathFx(fileSystem, parent);

			const hadTarget = yield* fileSystem.exists(target);
			yield* fileSystem.makeDirectory(recoveryDirectory, {
				recursive: true,
			});
			yield* syncFilesystemPathFx(fileSystem, recoveryRoot);
			yield* writeSyncedTextFx(
				path.join(recoveryDirectory, "record.json"),
				`${JSON.stringify({
					hadTarget,
					source,
					target,
					transaction,
				})}\n`,
			);

			const swap = yield* Effect.exit(
				Effect.uninterruptible(
					Effect.gen(function* () {
						yield* writeSyncedTextFx(path.join(recoveryDirectory, "publishing"), "1");
						if (hadTarget) {
							yield* fileSystem.rename(target, previous);
							yield* syncFilesystemPathFx(fileSystem, parent);
							yield* writeSyncedTextFx(path.join(recoveryDirectory, "moved"), "1");
						}
						yield* fileSystem.rename(pending, target);
						yield* syncFilesystemPathFx(fileSystem, parent);
						yield* writeSyncedTextFx(path.join(recoveryDirectory, "committed"), "1");
					}),
				),
			);
			if (Exit.isFailure(swap)) {
				yield* recoverOneEditorJsonExportFx(recoveryDirectory);
				return yield* Effect.failCause(swap.cause);
			}
			yield* fileSystem.remove(path.join(target, EditorJsonExportOwnershipFile));
			yield* syncFilesystemPathFx(fileSystem, target);
			yield* recoverOneEditorJsonExportFx(recoveryDirectory).pipe(Effect.ignore);
			return {
				json: exportedFiles.filter((file) => file.endsWith(".json")).length,
				resources: exportedFiles.filter((file) => file.endsWith(".png")).length,
				revision: project.marker.revision,
			} satisfies replaceEditorJsonExportDirectoryFx.Success;
		}).pipe(
			Effect.ensuring(
				fileSystem
					.remove(pending, {
						force: true,
						recursive: true,
					})
					.pipe(Effect.ignore),
			),
		);
	},
);
